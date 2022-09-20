/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isDeployableAccountIdType, walkOnUsers, WalkOnUsersCallback } from '../filters/account_id/account_id_filter'
import { JiraConfig } from '../config/config'
import { createIdToUserMap, IdMap } from '../filters/account_id/add_display_name_filter'
import JiraClient from '../client/client'

const log = logger(module)

const JIRA_USERS_PAGE = 'jira/people/search'

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
  fieldName,
  baseUrl,
  accountId,
} : {
  elemId: ElemID
  fieldName: string
  baseUrl: string
  accountId: string
}): ChangeError => {
  const url = new URL(JIRA_USERS_PAGE, baseUrl).href
  const { parent } = elemId.createTopLevelParentID()
  return {
    elemID: elemId,
    severity: 'Error',
    message: 'Specified account ID does not exist on the target environment. Element will not be deployed.',
    detailedMessage: `Cannot deploy the ${parent.typeName} “${parent.name}” as the account id ${accountId} in the property “${fieldName}” does not exist on the target environment.    
Go to ${url} to see valid users and account IDs`,
  }
}

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

const checkAndAddChangeErrors = (
  idMap: IdMap,
  baseUrl: string,
  changeErrors: ChangeError[]
): WalkOnUsersCallback => (
  { value, path, fieldName }
): void => {
  if (!_.isPlainObject(value[fieldName])) {
    return
  }
  const accountId = value[fieldName].id
  const currentDisplayName = value[fieldName].displayName
  const realDisplayName = idMap[accountId]
  if (!Object.prototype.hasOwnProperty.call(idMap, accountId)) {
    changeErrors.push(noAccountIdChangeError({
      elemId: path.createNestedID(fieldName),
      fieldName,
      baseUrl,
      accountId,
    }))
  } else if (currentDisplayName === undefined) {
    changeErrors.push(noDisplayNameChangeError(path.createNestedID(fieldName)))
  } else if (realDisplayName !== currentDisplayName) {
    changeErrors.push(displayNameMismatchChangeError(
      { elemId: path.createNestedID(fieldName),
        baseUrl,
        currentDisplayName,
        realDisplayName,
        accountId }
    ))
  }
}

const createChangeErrorsForAccountIdIssues = (
  element: InstanceElement,
  idMap: IdMap,
  baseUrl : string
): ChangeError[] => {
  const changeErrors: ChangeError[] = []
  walkOnElement({ element,
    func: walkOnUsers(checkAndAddChangeErrors(idMap, baseUrl, changeErrors)) })
  return changeErrors
}

export const accountIdValidator: (
  client: JiraClient,
  config: JiraConfig,
  paginator: clientUtils.Paginator) =>
  ChangeValidator = (client, config, paginator) => async changes =>
    log.time(async () => {
      if (!(config.fetch.showUserDisplayNames ?? true)) {
        return []
      }
      const { baseUrl } = client
      const idMap = await createIdToUserMap(paginator)
      return changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(change => getChangeData(change))
        .filter(isDeployableAccountIdType)
        .forEach(element =>
          walkOnElement({ element,
            func: walkOnUsers(checkAndCreateChangeErrors(idMap, baseUrl, changeErrors)) }))
      return changeErrors
    }, 'display name validator')
