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
import { resolvePath, resolveValues } from '@salto-io/adapter-utils'
import { ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { getUsers, TYPE_NAME_TO_REPLACER, VALID_USER_VALUES, getUserFallbackValue } from '../user_utils'
import { paginate } from '../client/pagination'
import ZendeskClient from '../client/client'
import { lookupFunc } from '../filters/field_references'
import { ZedneskDeployConfig } from '../config'

const { awu } = collections.asynciterable
const { createPaginator } = clientUtils
const { isDefined } = lowerdashValues

const MISSING_USERS_DOC_LINK = 'https://docs.salto.io/docs/username-not-found-in-target-environment'
const MISSING_USERS_ERROR_MSG = 'Element references users which don\'t exist in target environment'

const getMissingUsers = (instance: InstanceElement, existingUsers: Set<string>): string[] => {
  const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
  const missingUsers = userPaths
    .map(path => resolvePath(instance, path))
    .filter(userValue => !VALID_USER_VALUES.includes(userValue))
    .filter(userValue => !existingUsers.has(userValue))
  return _.uniq(missingUsers)
}

const getDefaultMissingUsersError = (
  instance: InstanceElement,
  userEmails: Set<string>,
): ChangeError | undefined => {
  const missingUsers = getMissingUsers(instance, userEmails)
  if (_.isEmpty(missingUsers)) {
    return undefined
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: MISSING_USERS_ERROR_MSG,
    detailedMessage: `The following users are referenced by this element, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment's user fallback options. Learn more: ${MISSING_USERS_DOC_LINK}`,
  }
}

const getMissingUsersChangeWarning = (
  instance: InstanceElement,
  userEmails: Set<string>,
  userFallbackValue: string
): ChangeError | undefined => {
  const missingUsers = getMissingUsers(instance, userEmails)
  if (_.isEmpty(missingUsers)) {
    return undefined
  }
  return {
    elemID: instance.elemID,
    severity: 'Warning',
    message: `${missingUsers.length} usernames will be overridden to ${userFallbackValue}`,
    detailedMessage: `The following users are referenced by this element, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIf you continue, they will be set to ${userFallbackValue} according to the environment's user fallback options. Learn more: ${MISSING_USERS_DOC_LINK}`,
  }
}

const getFallbackUserIsMissingError = (
  instance: InstanceElement,
  userEmails: Set<string>,
  userFallbackValue: string
): ChangeError | undefined => {
  const missingUsers = getMissingUsers(instance, userEmails)
  if (_.isEmpty(missingUsers)) {
    return undefined
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: MISSING_USERS_ERROR_MSG,
    detailedMessage: `The following users are referenced by this element, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn addition, the defined fallback user ${userFallbackValue} was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment's user fallback options. Learn more: ${MISSING_USERS_DOC_LINK}`,
  }
}

/**
 * Verifies users exists before deployment of an element with user fields.
 * If the deploy option 'defaultMissingUserFallback' exists, warns the user about missing users changes
 */
export const missingUsersValidator: (client: ZendeskClient, deployConfig?: ZedneskDeployConfig) =>
  ChangeValidator = (client, deployConfig) => async changes => {
    const relevantInstances = await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => Object.keys(TYPE_NAME_TO_REPLACER).includes(instance.elemID.typeName))
      .map(data => resolveValues(data, lookupFunc))
      .toArray()

    if (_.isEmpty(relevantInstances)) {
      return []
    }

    const paginator = createPaginator({
      client,
      paginationFuncCreator: paginate,
    })
    const usersEmails = new Set((await getUsers(paginator)).map(user => user.email))

    const missingUserFallback = deployConfig?.defaultMissingUserFallback
    if (missingUserFallback !== undefined) {
      const { fallbackValue, isValidValue } = await getUserFallbackValue(missingUserFallback, usersEmails, client)
      if (fallbackValue !== undefined) {
        return relevantInstances
          .map(instance => getMissingUsersChangeWarning(instance, usersEmails, fallbackValue))
          .filter(isDefined)
      }
      if (!isValidValue) {
        return relevantInstances
          .map(instance => getFallbackUserIsMissingError(instance, usersEmails, missingUserFallback))
          .filter(isDefined)
      }
    }
    return relevantInstances
      .map(instance => getDefaultMissingUsersError(instance, usersEmails))
      .filter(isDefined)
  }
