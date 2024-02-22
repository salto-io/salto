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
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData, resolvePath, setPath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { Change, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'
import { getUsers, USER_MAPPING, getUsersFromInstances, DEFAULT_CONVERT_USERS_IDS_VALUE } from '../user_utils'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array

const isRelevantInstance = (instance: InstanceElement): boolean =>
  Object.keys(USER_MAPPING).includes(instance.elemID.typeName)

const replaceValues = (instance: InstanceElement, mapping: Record<string, string>): void => {
  const paths = USER_MAPPING[instance.elemID.typeName]
  paths.forEach(path => {
    const usersPath = instance.elemID.createNestedID(...path)
    const resolvedPath = resolvePath(instance, usersPath)
    const userValues = makeArray(resolvedPath)
    if (resolvedPath === undefined) {
      return
    }
    const newValues = userValues.map(value => {
      const newValue = Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : undefined
      return newValue ?? value
    })
    setPath(instance, usersPath, _.isArray(resolvedPath) ? newValues : newValues[0])
  })
}

export const replaceValuesForChanges = async (
  changes: Change<InstanceElement>[],
  mapping: Record<string, string>,
): Promise<void> => {
  await awu(changes).forEach(async change => {
    await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
      replaceValues(instance, mapping)
      return instance
    })
  })
}

/**
 * Replaces user ids with login name, when 'convertUsersIds' config flag is enabled
 */
const filterCreator: FilterCreator = ({ paginator, config, usersPromise }) => {
  let userIdToLogin: Record<string, string> = {}
  return {
    name: 'usersFilter',
    onFetch: async elements => {
      if (!(config[FETCH_CONFIG].convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)) {
        log.debug('Converting user ids was disabled (onFetch)')
        return
      }
      const users = await usersPromise
      if (!users || _.isEmpty(users)) {
        log.warn('Could not find any users (onFetch)')
        return
      }
      const mapping = Object.fromEntries(users.map(user => [user.id, user.profile.login]))
      const instances = elements.filter(isInstanceElement).filter(isRelevantInstance)
      instances.forEach(instance => {
        replaceValues(instance, mapping)
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      const { convertUsersIds } = config[FETCH_CONFIG]
      if (!(convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)) {
        log.debug('Converting user ids was disabled (preDeploy)')
        return
      }
      const usersToReplace = getUsersFromInstances(changes.map(getChangeData))

      if (_.isEmpty(usersToReplace)) {
        return
      }
      const users = await getUsers(paginator, { userIds: usersToReplace, property: 'profile.login' })
      if (_.isEmpty(users)) {
        log.warn('Could not find any users (preDeploy)')
        return
      }

      userIdToLogin = Object.fromEntries(users.map(user => [user.id, user.profile.login]))
      const loginToUserId = Object.fromEntries(users.map(user => [user.profile.login, user.id])) as Record<
        string,
        string
      >
      await replaceValuesForChanges(changes, loginToUserId)
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      if (!(config[FETCH_CONFIG].convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)) {
        log.debug('Converting user ids was disabled (onDeploy)')
        return
      }
      const relevantChanges = changes.filter(change => isRelevantInstance(getChangeData(change)))
      if (_.isEmpty(relevantChanges)) {
        return
      }
      await replaceValuesForChanges(changes, userIdToLogin)
    },
  }
}

export default filterCreator
