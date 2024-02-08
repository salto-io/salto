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

import {
  ChangeError,
  ElemID,
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { paginate } from '../client/pagination'
import { DEPLOY_CONFIG, FETCH_CONFIG } from '../config'
import { MISSING_USERS_DOC_LINK, MISSING_USERS_ERROR_MSG, TYPE_NAME_TO_REPLACER, VALID_USER_VALUES, getUserFallbackValue, getUsers, User } from '../user_utils'
import { FixElementsHandler } from './types'
import { CUSTOM_OBJECT_FIELD_TYPE_NAME, TICKET_FIELD_TYPE_NAME, TRIGGER_TYPE_NAME } from '../constants'
import { FieldsParams, ValueReplacer, replaceConditionsAndActionsCreator } from '../replacers_utils'

const log = logger(module)
const { createPaginator } = clientUtils

const fallbackUserIsMissingError = (
  instance: InstanceElement,
  missingUsers: string[],
  userFallbackValue: string
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: MISSING_USERS_ERROR_MSG,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn addition, we could not get the defined fallback user ${userFallbackValue}. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

const missingUsersChangeWarning = (
  instance: InstanceElement,
  missingUsers: string[],
  userFallbackValue: string
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `${missingUsers.length} usernames will be overridden to ${userFallbackValue}`,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIf you continue, they will be set to ${userFallbackValue} according to the environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

const replacerParams = (primaryField: string): FieldsParams[] => [
  { fieldName: [primaryField, 'all'], fieldsToReplace: [], overrideFilterCriteria: [condition => !!_.get(condition, 'is_user_value')] },
  { fieldName: [primaryField, 'any'], fieldsToReplace: [], overrideFilterCriteria: [condition => !!_.get(condition, 'is_user_value')] },
]

const CUSTOM_OBJECT_FIELD_TYPES_TO_REPLACER: Record<string, ValueReplacer> = {
  [TRIGGER_TYPE_NAME]: replaceConditionsAndActionsCreator(replacerParams('conditions')),
  [TICKET_FIELD_TYPE_NAME]: replaceConditionsAndActionsCreator(replacerParams('relationship_filter')),
  [CUSTOM_OBJECT_FIELD_TYPE_NAME]: replaceConditionsAndActionsCreator(replacerParams('relationship_filter')),
}

const getMissingUserPaths = (
  users: Set<string>,
  instance: InstanceElement
): { user: string; path: ElemID }[] => {
  const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance).concat(
    CUSTOM_OBJECT_FIELD_TYPES_TO_REPLACER[instance.elemID.typeName]?.(instance) ?? []
  )
  return userPaths.map(path => {
    const user = resolvePath(instance, path)
    if (!VALID_USER_VALUES.includes(user) && !users.has(user)) {
      return { user, path }
    }
    return undefined
  }).filter(values.isDefined)
}

const getMissingUsers = (users: Set<string>) => (
  instance: InstanceElement
): { instance: InstanceElement; missingUsers: string[] } =>
  ({ instance, missingUsers: _.uniq(getMissingUserPaths(users, instance).map(({ user }) => user)) })

const replaceMissingUsers = (
  users: Set<string>,
  fallbackUser: string
) => (instance: InstanceElement): undefined |
{ fixedInstance: InstanceElement; missingUsers: string[] } => {
  const missingUserPaths = getMissingUserPaths(users, instance)

  if (_.isEmpty(missingUserPaths)) {
    return undefined
  }
  const fixedInstance = instance.clone()
  missingUserPaths.forEach(({ path }) => setPath(fixedInstance, path, fallbackUser))
  return { fixedInstance, missingUsers: _.uniq(missingUserPaths.map(({ user }) => user)) }
}

const noRelevantUsers = (
  users: User[], defaultMissingUserFallback: string | undefined, resolveUserIDs: boolean | undefined
): boolean => {
  if (_.isEmpty(users)) {
    // If the user does not want to resolve user IDs (fetch all users),
    // we will replace them to the deployer's ID if requested.
    const doNotResolveIdsAndDeployerFallback = resolveUserIDs === false
      && defaultMissingUserFallback === definitions.DEPLOYER_FALLBACK_VALUE
    return !doNotResolveIdsAndDeployerFallback
  }
  return false
}

const isRelevantElement = (element: unknown): element is InstanceElement =>
  isInstanceElement(element) && Object.keys(TYPE_NAME_TO_REPLACER).includes(element.elemID.typeName)

/**
 * Change missing users (emails or ids) to fallback user.
 * If fallback user is not provided, do nothing
 * The errors returned will vary:
 * 1. If provided fallback user is valid, return warning severity errors
 * 2. If provided fallback user is not valid, return error severity errors
 */
export const fallbackUsersHandler: FixElementsHandler = (
  { client, config }
) => async elements => {
  const paginator = createPaginator({
    client,
    paginationFuncCreator: paginate,
  })
  const { users } = await getUsers(paginator, config[FETCH_CONFIG].resolveUserIDs)
  const { defaultMissingUserFallback } = config[DEPLOY_CONFIG] || {}
  if (defaultMissingUserFallback === undefined
    || noRelevantUsers(users, defaultMissingUserFallback, config[FETCH_CONFIG].resolveUserIDs)) {
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
      .filter(isRelevantElement)
      .map(getMissingUsers(userEmails))
      .filter(({ missingUsers }) => !_.isEmpty(missingUsers))
      .map(({ instance, missingUsers }) =>
        fallbackUserIsMissingError(instance, missingUsers, defaultMissingUserFallback))

    return { fixedElements: [], errors }
  }
  const fixedElementsWithUserCount = elements
    .filter(isRelevantElement)
    .map(replaceMissingUsers(userEmails, fallbackValue))
    .filter(values.isDefined)
  const errors = fixedElementsWithUserCount.map(({ fixedInstance, missingUsers }) =>
    missingUsersChangeWarning(fixedInstance, missingUsers, fallbackValue))
  return { fixedElements: fixedElementsWithUserCount.map(({ fixedInstance }) => fixedInstance), errors }
}
