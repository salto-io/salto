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
import { ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { isPermissionSchemeStructure, PermissionHolder } from '../filters/permission_scheme/omit_permissions_common'
import { JIRA_USERS_PAGE, PERMISSION_SCHEME_TYPE_NAME } from '../constants'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { wrongUserPermissionSchemePredicateCreator } from '../filters/permission_scheme/wrong_user_permission_scheme_filter'
import { getUsersMap, getUsersMapByVisibleId } from '../users'


const createChangeError = (
  element: InstanceElement,
  permission: PermissionHolder,
  url: string
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Warning',
  message: 'An account ID in a permission scheme does not exist in target environment. The scheme will be deployed without that user’s permission.',
  detailedMessage: `The account id “${permission.holder.parameter.id}”, specified in permission scheme ${element.elemID.createTopLevelParentID().parent.name}, does not exist in target environment.
The Permission Scheme will be deployed without the ${permission.permission} permission containing that account ID.
To fix this, make sure the account ID exists in target environment, or remove this permission from the permission scheme.
Check ${new URL(JIRA_USERS_PAGE, url).href} to see valid users and account IDs.`,
})

/**
* Permission Schemes have a list of permissions.
* If one of them has a wrong account ID the whole element will fail.
* This validator informs the user that a wrong account ID is present,
* and that the relevant permission will be removed.
*/
export const wrongUserPermissionSchemeValidator: (
  client: JiraClient,
  config: JiraConfig,
  ) => ChangeValidator = (client, config) => async (changes, elementsSource) => {
    if (!(config.fetch.convertUsersIds ?? true)) {
      return []
    }
    const { baseUrl } = client
    const rawUserMap = await getUsersMap(elementsSource)
    if (rawUserMap === undefined) {
      return []
    }
    const userMap = getUsersMapByVisibleId(rawUserMap, client.isDataCenter)

    const wrongUserPermissionSchemePredicate = wrongUserPermissionSchemePredicateCreator(userMap)
    return changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(element => element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME
        && element.value.permissions !== undefined)
      .flatMap(element => element.value.permissions.flatMap((permission: PermissionHolder) => (
        (isPermissionSchemeStructure(permission)
        && wrongUserPermissionSchemePredicate(permission))
          ? createChangeError(element, permission, baseUrl) : [])))
  }
