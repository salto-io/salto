/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { Change, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { getIdByEmail, getUsers, TYPE_NAME_TO_REPLACER, VALID_USER_VALUES, getUserFallbackValue } from '../user_utils'
import { deployModificationFunc } from '../replacers_utils'
import { paginate } from '../client/pagination'
import { DEPLOY_CONFIG } from '../config'

const log = logger(module)
const { createPaginator } = clientUtils

const isRelevantChange = (change: Change<InstanceElement>): boolean => (
  Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName)
)

// Replace missing user values with user fallback value provided in deploy config
const replaceMissingUsers = (
  changes: Change<InstanceElement>[],
  users: Set<string>,
  fallbackUser: string
): void => {
  const instances = changes.map(change => getChangeData(change))
  instances.forEach(instance => {
    const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
    userPaths.forEach(path => {
      const userValue = resolvePath(instance, path)
      if (!VALID_USER_VALUES.includes(userValue) && !users.has(userValue)) {
        setPath(instance, path, fallbackUser)
      }
    })
  })
}

/**
 * Replaces the user ids with emails
 */
const filterCreator: FilterCreator = ({ client, config }) => {
  let userIdToEmail: Record<string, string> = {}
  return {
    name: 'usersFilter',
    onFetch: async elements => {
      const paginator = createPaginator({
        client,
        paginationFuncCreator: paginate,
      })
      const mapping = await getIdByEmail(paginator)
      const instances = elements.filter(isInstanceElement)
      instances.forEach(instance => {
        TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, mapping)
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges)) {
        return
      }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: paginate,
      })
      const users = await getUsers(paginator)
      if (_.isEmpty(users)) {
        return
      }
      const { defaultMissingUserFallback } = config[DEPLOY_CONFIG] ?? {}
      if (defaultMissingUserFallback !== undefined) {
        const userEmails = new Set(users.map(user => user.email))
        const fallbackValue = await getUserFallbackValue(
          defaultMissingUserFallback,
          userEmails,
          client
        )
        if (fallbackValue !== undefined) {
          replaceMissingUsers(relevantChanges, userEmails, fallbackValue)
        } else {
          log.error('Error while trying to get defaultMissingUserFallback value')
        }
      }

      userIdToEmail = Object.fromEntries(
        users.map(user => [user.id.toString(), user.email])
      ) as Record<string, string>
      userIdToEmail = await getIdByEmail(paginator)
      const emailToUserId = Object.fromEntries(
        users.map(user => [user.email, user.id.toString()])
      ) as Record<string, string>
      await deployModificationFunc(changes, emailToUserId, TYPE_NAME_TO_REPLACER)
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges)) {
        return
      }
      await deployModificationFunc(changes, userIdToEmail, TYPE_NAME_TO_REPLACER)
    },
  }
}

export default filterCreator
