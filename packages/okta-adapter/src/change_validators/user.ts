/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { client as clientUtils, elements as elementsUtils } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { paginate } from '../client/pagination'
import OktaClient from '../client/client'
import {
  getUsers,
  getUsersFromInstances,
  OMIT_MISSING_USERS_CONFIGURATION_LINK,
  shouldConvertUserIds,
  USER_MAPPING,
} from '../user_utils'
import { OktaUserConfig } from '../user_config'

const { isDefined } = values
const { createPaginator } = clientUtils
const log = logger(module)

/**
 * Verifies users exist in the environement before deployment of an instance with user references
 */
export const usersValidator: (
  client: OktaClient,
  userConfig: OktaUserConfig,
  fetchQuery: elementsUtils.query.ElementQuery,
) => ChangeValidator = (client, config, fetchQuery) => async changes => {
  if (!shouldConvertUserIds(fetchQuery, config)) {
    log.trace('Skipped usersValidator because convertUsersIds config flag is disabled')
    return []
  }
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => Object.keys(USER_MAPPING).includes(instance.elemID.typeName))

  const usersToFetch = getUsersFromInstances(relevantInstances)

  if (_.isEmpty(usersToFetch)) {
    return []
  }

  const paginator = createPaginator({
    client,
    paginationFuncCreator: paginate,
  })

  const users = await getUsers(paginator, { userIds: usersToFetch, property: 'profile.login' })

  const existingUsers = new Set(users.map(user => user.profile.login))

  const missingUsersByInstanceId = Object.fromEntries(
    relevantInstances
      .map(instance => {
        const userPaths = USER_MAPPING[instance.elemID.typeName]
        const missingUsers = userPaths
          .flatMap(path => resolvePath(instance, instance.elemID.createNestedID(...path)))
          .filter(user => user !== undefined)
          .filter(user => !existingUsers.has(user))
        if (!_.isEmpty(missingUsers)) {
          return [instance.elemID.getFullName(), missingUsers]
        }
        return undefined
      })
      .filter(isDefined),
  )

  return relevantInstances
    .filter(instance => missingUsersByInstanceId[instance.elemID.getFullName()] !== undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: "Instance references users which don't exist in target environment",
      detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsersByInstanceId[instance.elemID.getFullName()].join(', ')}.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames or configure omitMissingUsers: ${OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
    }))
}
