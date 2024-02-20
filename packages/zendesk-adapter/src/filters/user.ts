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
import { Change, InstanceElement, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { TYPE_NAME_TO_REPLACER, getIdByEmail } from '../users/user_utils'
import { deployModificationFunc } from '../replacers_utils'
import { paginate } from '../client/pagination'
import { FETCH_CONFIG } from '../config'

const { createPaginator } = clientUtils

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName)

/**
 * Replaces the user ids with emails
 */
const filterCreator: FilterCreator = ({ client, config, usersPromise }) => {
  let userIdToEmail: Record<string, string> = {}
  const { resolveUserIDs } = config[FETCH_CONFIG]
  return {
    name: 'usersFilter',
    onFetch: async elements => {
      const paginator = createPaginator({
        client,
        paginationFuncCreator: paginate,
      })

      const mapping = await getIdByEmail(paginator, resolveUserIDs)
      const instances = elements.filter(isInstanceElement)
      instances.forEach(instance => {
        TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, mapping)
      })

      if (usersPromise === undefined) {
        return {}
      }

      const { errors } = await usersPromise
      // eslint-disable-next-line no-console
      console.log(`(4/5)[a] in users filter, ${errors?.length}  errors`)

      return { errors }
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges) || usersPromise === undefined) {
        return
      }
      const paginator = createPaginator({
        client,
        paginationFuncCreator: paginate,
      })
      const { users } = await usersPromise
      // eslint-disable-next-line no-console
      console.log(`(4/5)[b] in users filter, ${users.length} users`)
      if (_.isEmpty(users)) {
        return
      }
      userIdToEmail = Object.fromEntries(users.map(user => [user.id.toString(), user.email])) as Record<string, string>
      userIdToEmail = await getIdByEmail(paginator, resolveUserIDs)
      const emailToUserId = Object.fromEntries(users.map(user => [user.email, user.id.toString()])) as Record<
        string,
        string
      >
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
