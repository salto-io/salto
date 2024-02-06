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
import { ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { walkOnElement } from '@salto-io/adapter-utils'
import { isDeployableAccountIdType, walkOnUsers, WalkOnUsersCallback } from '../filters/account_id/account_id_filter'
import { getUserIdFromEmail, getUsersMap, getUsersMapByVisibleId, UserMap } from '../users'
import { JiraConfig } from '../config/config'
import JiraClient from '../client/client'
import { JIRA_USERS_PAGE, PERMISSION_SCHEME_TYPE_NAME } from '../constants'

type DisplayNameMismatchDetails = {
  currentDisplayName: string
  realDisplayName: string
  accountId: string
  elemId: ElemID
}

type missingUsersDetails = {
  accountId: string
  displayName?: string
}

const formatMissingUser = (missingUser: missingUsersDetails): string =>
  (missingUser.displayName ? `${missingUser.accountId}: "${missingUser.displayName}"` : missingUser.accountId)

const formatMissingUsers = (missingUsers: missingUsersDetails[]): string =>
  `${missingUsers.map(formatMissingUser).join(',')}`

const noDisplayNameChangeError = (
  elemId: ElemID,
): ChangeError => ({
  elemID: elemId,
  severity: 'Info',
  message: 'A display name was not attached to an element.',
  detailedMessage: `A display name was not attached to ${elemId.getFullName()}. It will be added in the first fetch after this deployment.`,
})

const noAccountIdChangeError = ({
  elemId,
  missingUsers,
} : {
  elemId: ElemID
  missingUsers: missingUsersDetails[]
}): ChangeError => ({
  elemID: elemId,
  severity: 'Error',
  message: 'Element references users which don’t exist in target environment',
  detailedMessage: `The following users are referenced by this element, but do not exist in the target environment: ${formatMissingUsers(missingUsers)}. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira`,
})

const replacingAccountIdChangeError = ({
  elemId,
  missingUsers,
  defaultUser,
} : {
  elemId: ElemID
  missingUsers: missingUsersDetails[]
  defaultUser: string
}): ChangeError => {
  const user = defaultUser === definitions.DEPLOYER_FALLBACK_VALUE ? 'the deployer\'s user' : defaultUser
  return {
    elemID: elemId,
    severity: 'Warning',
    message: `${missingUsers.length} usernames will be overridden to ${user}`,
    detailedMessage: `The following users are referenced by this element, but do not exist in the target environment: ${formatMissingUsers(missingUsers)}. If you continue, they will be set to ${user} according to the environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira`,
  }
}

const noFallbackUserAccountIdChangeError = ({
  elemId,
  missingUsers,
  defaultUser,
} : {
  elemId: ElemID
  missingUsers: missingUsersDetails[]
  defaultUser: string
}): ChangeError => ({
  elemID: elemId,
  severity: 'Error',
  message: 'Element references users which don’t exist in target environment',
  detailedMessage: `The following users are referenced by this element, but do not exist in the target environment: ${formatMissingUsers(missingUsers)}. In addition, the defined fallback user ${defaultUser} was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira`,
})

const displayNameMismatchChangeError = ({
  elemId,
  baseUrl,
  currentDisplayName,
  realDisplayName,
  accountId,
} : {
  elemId: ElemID
  baseUrl: string
  currentDisplayName: string
  realDisplayName: string
  accountId: string
}): ChangeError => {
  const url = new URL(JIRA_USERS_PAGE, baseUrl).href
  const { parent } = elemId.createTopLevelParentID()
  return {
    elemID: elemId,
    severity: 'Warning',
    message: 'The display name does not match the specified account ID. The element will be deployed with the appropriate display name instead.',
    detailedMessage: `The display name “${currentDisplayName}" in ${elemId.name} does not match the specified account ID ${accountId}.
The ${parent.typeName} “${parent.name}” will be deployed with the appropriate display name instead: “${realDisplayName}”.
Go to ${url} to see valid users and account IDs.`,
  }
}

const doesDefaultUserExist = (
  defaultUser: string | undefined,
  userMap: UserMap,
  isDataCenter: boolean,
): boolean => {
  if (defaultUser === undefined) {
    return false
  }

  if (defaultUser === definitions.DEPLOYER_FALLBACK_VALUE) {
    return true
  }

  if (isDataCenter) {
    return Object.prototype.hasOwnProperty.call(userMap, defaultUser)
  }

  return getUserIdFromEmail(defaultUser, userMap) !== undefined
}

const checkAndAddChangeErrors = (
  userMap: UserMap,
  isDataCenter: boolean,
  missingUsers: missingUsersDetails[],
  displayNameMismatches: DisplayNameMismatchDetails[],
  missingDisplayNamePaths: ElemID[]
): WalkOnUsersCallback => (
  { value, path, fieldName }
): void => {
  if (!_.isPlainObject(value[fieldName])) {
    return
  }
  const accountId = value[fieldName].id
  const currentDisplayName = value[fieldName].displayName
  if (path.typeName === PERMISSION_SCHEME_TYPE_NAME
      && !Object.prototype.hasOwnProperty.call(userMap, accountId)) {
    return // handled by wrongUserPermissionScheme validator
  }

  if (!Object.prototype.hasOwnProperty.call(userMap, accountId)) {
    missingUsers.push({ accountId, displayName: currentDisplayName })
    return
  }
  // in DC we don't save User's displayName
  if (isDataCenter) {
    return
  }

  const realDisplayName = userMap[accountId].displayName

  if (currentDisplayName === undefined) {
    missingDisplayNamePaths.push(path.createNestedID(fieldName))
  } else if (realDisplayName !== currentDisplayName) {
    displayNameMismatches.push({
      currentDisplayName,
      realDisplayName,
      accountId,
      elemId: path.createNestedID(fieldName),
    })
  }
}

const createChangeErrorsForAccountIdIssues = (
  element: InstanceElement,
  userMap: UserMap,
  baseUrl : string,
  isDataCenter: boolean,
  config: JiraConfig,
  defaultUserExists: boolean,
): ChangeError[] => {
  const allMissingUsers: missingUsersDetails[] = []
  const displayNameMismatches: DisplayNameMismatchDetails[] = []
  const missingDisplayNamePaths: ElemID[] = []
  walkOnElement({ element,
    func: walkOnUsers(checkAndAddChangeErrors(
      userMap,
      isDataCenter,
      allMissingUsers,
      displayNameMismatches,
      missingDisplayNamePaths
    ), config) })

  const missingUsers = _.uniqBy(allMissingUsers, formatMissingUser)
  const changeErrors: ChangeError[] = []

  if (missingUsers.length > 0) {
    if (config.deploy.defaultMissingUserFallback === undefined) {
      changeErrors.push(noAccountIdChangeError({
        elemId: element.elemID,
        missingUsers,
      }))
    } else if (defaultUserExists) {
      changeErrors.push(replacingAccountIdChangeError({
        elemId: element.elemID,
        missingUsers,
        defaultUser: config.deploy.defaultMissingUserFallback,
      }))
    } else {
      changeErrors.push(noFallbackUserAccountIdChangeError({
        elemId: element.elemID,
        missingUsers,
        defaultUser: config.deploy.defaultMissingUserFallback,
      }))
    }
  }

  displayNameMismatches.forEach(mismatch => {
    changeErrors.push(displayNameMismatchChangeError({
      elemId: mismatch.elemId,
      currentDisplayName: mismatch.currentDisplayName,
      realDisplayName: mismatch.realDisplayName,
      accountId: mismatch.accountId,
      baseUrl,
    }))
  })

  missingDisplayNamePaths.forEach(elemId => {
    changeErrors.push(noDisplayNameChangeError(elemId))
  })

  return changeErrors
}

/**
 * Validates that all account IDs exist, and that all display names match them
 */
export const accountIdValidator: (
  client: JiraClient,
  config: JiraConfig,
) => ChangeValidator = (client, config) => async (changes, elementsSource) => {
  if (!(config.fetch.convertUsersIds ?? true)) {
    return []
  }
  const { baseUrl, isDataCenter } = client
  const rawUserMap = await getUsersMap(elementsSource)
  if (rawUserMap === undefined) {
    return []
  }
  const userMap = getUsersMapByVisibleId(rawUserMap, client.isDataCenter)

  const defaultUserExist = doesDefaultUserExist(config.deploy.defaultMissingUserFallback, userMap, isDataCenter)
  return changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(change => getChangeData(change))
    .filter(isDeployableAccountIdType)
    .map(
      element => createChangeErrorsForAccountIdIssues(
        element, userMap, baseUrl, isDataCenter, config, defaultUserExist
      )
    )
    .flat()
}
