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

import { ChangeError, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { paginate } from '../client/pagination'
import { DEPLOY_CONFIG, FETCH_CONFIG } from '../config'
import {
  TYPES_WITH_USERS,
  getUsers,
  getUsersFromInstances,
  USER_MAPPING,
  OMIT_MISSING_USERS_CONFIGURATION_LINK,
} from '../user_utils'
import { FixElementsHandler } from './types'
import { USER_TYPE_NAME } from '../constants'

const log = logger(module)

const { createPaginator } = clientUtils

const omitUsersChangeWarning = (instance: InstanceElement, missingUsers: string[]): ChangeError => {
  const isSingular = missingUsers.length === 1
  return {
    elemID: instance.elemID,
    severity: 'Warning',
    message: `${missingUsers.length} user${isSingular ? '' : 's'} will be omitted`,
    detailedMessage: `The following ${isSingular ? 'user is' : 'users are'} referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIf you continue, they will be omitted. Learn more: ${OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
  }
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(s => _.isString(s))

const getUsersToOmitAndNewValue = (
  instance: InstanceElement,
  users: Set<string>,
): { usersToOmit: string[]; path: ElemID; newValue: string[] }[] => {
  if (!TYPES_WITH_USERS.has(instance.elemID.typeName)) {
    return []
  }
  const userPaths = USER_MAPPING[instance.elemID.typeName]
  const pathsAsElemIds = _.uniq(userPaths.map(path => instance.elemID.createNestedID(...path)))
  return pathsAsElemIds.flatMap(path => {
    const usersArray = resolvePath(instance, path)
    if (!isStringArray(usersArray)) {
      return []
    }
    const [newValue, usersToOmit] = _.partition(usersArray, user => users.has(user))
    log.debug('Found on instance %s users to omit %o', instance.elemID.getFullName(), usersToOmit)
    if (_.isEmpty(usersToOmit)) {
      return []
    }
    return [{ usersToOmit, path, newValue }]
  })
}

const cloneAndOmitUsers =
  (users: Set<string>) =>
  (instance: InstanceElement): undefined | { fixedInstance: InstanceElement; missingUsers: string[] } => {
    const missingUsersPaths = getUsersToOmitAndNewValue(instance, users)
    if (_.isEmpty(missingUsersPaths)) {
      return undefined
    }
    const fixedInstance = instance.clone()
    missingUsersPaths.forEach(({ path, newValue }) =>
      setPath(fixedInstance, path, _.isEmpty(newValue) ? undefined : newValue),
    )
    return { fixedInstance, missingUsers: _.uniq(missingUsersPaths.flatMap(({ usersToOmit }) => usersToOmit)) }
  }

const isInstanceWithUsers = (element: unknown): element is InstanceElement =>
  isInstanceElement(element) && TYPES_WITH_USERS.has(element.elemID.typeName)

/**
 * Omit missing users (emails) in all instances that have users array.
 * An error with severity "Warning" will be returned for each fixed instance
 */
export const omitMissingUsersHandler: FixElementsHandler =
  ({ config, client, fetchQuery }) =>
  async elements => {
    const { omitMissingUsers } = config[DEPLOY_CONFIG] || {}
    if (!omitMissingUsers || fetchQuery.isTypeMatch(USER_TYPE_NAME)) {
      return { fixedElements: [], errors: [] }
    }
    log.trace('start omitMissingUsersHandler function')
    const paginator = createPaginator({
      client,
      paginationFuncCreator: paginate,
    })

    const instancesWithUsers = elements.filter(isInstanceWithUsers)

    const usersFromInstances = getUsersFromInstances(instancesWithUsers)

    if (_.isEmpty(usersFromInstances)) {
      log.debug('found no users, skipping omitMissingUsersHandler')
      return { fixedElements: [], errors: [] }
    }
    const { convertUsersIds } = config[FETCH_CONFIG]
    const usersInTarget = new Set(
      (
        await getUsers(paginator, {
          userIds: usersFromInstances,
          property: convertUsersIds === false ? 'id' : 'profile.login',
        })
      ).flatMap(user => [user.profile.login, user.id]),
    )
    const fixedElementsAndOmittedUsers = instancesWithUsers
      .map(cloneAndOmitUsers(usersInTarget))
      .filter(values.isDefined)
    const errors = fixedElementsAndOmittedUsers.map(({ fixedInstance, missingUsers }) =>
      omitUsersChangeWarning(fixedInstance, missingUsers),
    )
    return { fixedElements: fixedElementsAndOmittedUsers.map(({ fixedInstance }) => fixedInstance), errors }
  }
