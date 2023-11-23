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

import {
  ChangeError,
  ElemID,
  FixElementsFunc,
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { paginate } from '../client/pagination'
import { MISSING_USERS_DOC_LINK, MISSING_USERS_ERROR_MSG, TYPE_NAME_TO_REPLACER, VALID_USER_VALUES, getUserFallbackValue, getUsers } from '../user_utils'
import { FallBackUserHandler } from './fallback_user_handler'

const log = logger(module)
const { createPaginator } = clientUtils

const getFallbackUserIsMissingError = (
  instance: InstanceElement,
  missingUsers: string[],
  userFallbackValue: string
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: MISSING_USERS_ERROR_MSG,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn addition, we could not get the defined fallback user ${userFallbackValue}. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

const getMissingUsersChangeWarning = (
  instance: InstanceElement,
  missingUsers: string[],
  userFallbackValue: string
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `${missingUsers.length} usernames will be overridden to ${userFallbackValue}`,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIf you continue, they will be set to ${userFallbackValue} according to the environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

const getMissingUserPaths = (
  users: Set<string>,
  instance: InstanceElement
): { user: string; path: ElemID }[] => {
  const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
  return userPaths.map(path => {
    const user = resolvePath(instance, path)
    if (!VALID_USER_VALUES.includes(user) && !users.has(user)) {
      return { user, path }
    }
    return undefined
  }).filter(values.isDefined)
}

const getFallbackUserIsMissingUsers = (users: Set<string>) => (
  instance: InstanceElement
): { instance: InstanceElement; users: string[] } =>
  ({ instance, users: _.uniq(getMissingUserPaths(users, instance).map(({ user }) => user)) })

const replaceMissingUsers = (
  users: Set<string>,
  fallbackUser: string
) => (instance: InstanceElement): undefined |
{ fixedInstance: InstanceElement; missingUsers: string[] } => {
  const missingUserPaths = getMissingUserPaths(users, instance)

  if (!missingUserPaths) {
    return undefined
  }
  const fixedInstance = instance.clone()
  missingUserPaths.forEach(({ path }) => setPath(fixedInstance, path, fallbackUser))
  return { fixedInstance, missingUsers: _.uniq(missingUserPaths.map(({ user }) => user)) }
}

/**
 * Change missing users (emails or ids) to fallback user.
 * If fallback user is not provided, do nothing
 * The errors returned will vary:
 * 1. If provided fallback user is valid, return warning severity errors
 * 2. If provided fallback user is not valid, return error severity errors
 */
const missingUsersToFallback: FallBackUserHandler['missingUsersToFallback'] = (
  client,
  config
): FixElementsFunc => async elements => {
  const paginator = createPaginator({
    client,
    paginationFuncCreator: paginate,
  })
  const users = await getUsers(paginator)
  const { defaultMissingUserFallback } = config
  if (_.isEmpty(users) || defaultMissingUserFallback === undefined) {
    return { fixedElements: [], errors: [] }
  }

  const userEmails = new Set(users.map(user => user.email))
  const fallbackValue = await getUserFallbackValue(
    defaultMissingUserFallback,
    userEmails,
    client
  )
  if (fallbackValue === undefined) {
    log.error('Error while trying to get defaultMissingUserFallback value')
    const errors = elements.filter(isInstanceElement)
      .map(getFallbackUserIsMissingUsers(userEmails))
      .filter(values.isDefined)
      .map(({ instance, users: missingUsers }) =>
        getFallbackUserIsMissingError(instance, missingUsers, defaultMissingUserFallback))

    return { fixedElements: [], errors }
  }
  const fixedElementsWithUserCount = elements
    .filter(isInstanceElement)
    .map(replaceMissingUsers(userEmails, fallbackValue))
    .filter(values.isDefined)
  const errors = fixedElementsWithUserCount.map(({ fixedInstance, missingUsers }) =>
    getMissingUsersChangeWarning(fixedInstance, missingUsers, fallbackValue))
  return { fixedElements: fixedElementsWithUserCount.map(({ fixedInstance }) => fixedInstance), errors }
}

export const usersHandler: FallBackUserHandler = {
  missingUsersToFallback,
}
