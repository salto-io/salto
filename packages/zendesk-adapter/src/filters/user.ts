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
import { logger } from '@salto-io/logging'
import { TYPE_NAME_TO_REPLACER, getIdByEmail } from '../users/user_utils'
import { deployModificationFunc } from '../replacers_utils'
import { FilterCreator } from '../filter'

const log = logger(module)

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName)

/**
 * Replaces the user ids with emails
 */
const filterCreator: FilterCreator = ({ usersPromise }) => {
  let userIdToEmail: Record<string, string> = {}
  return {
    name: 'usersFilter',
    onFetch: async elements => {
      if (usersPromise === undefined) {
        log.trace('getUserPromise is undefined in onFetch')
        return {}
      }

      const mapping = await getIdByEmail(usersPromise)
      const instances = elements.filter(isInstanceElement)
      instances.forEach(instance => {
        TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, mapping)
      })

      const { errors } = await usersPromise
      return { errors }
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges) || usersPromise === undefined) {
        return
      }
      const { users } = await usersPromise
      if (_.isEmpty(users)) {
        return
      }
      userIdToEmail = Object.fromEntries(users.map(user => [user.id.toString(), user.email])) as Record<string, string>
      userIdToEmail = await getIdByEmail(usersPromise)
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
