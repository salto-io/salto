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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { PermissionHolder } from '../filters/permission_scheme/omit_permissions_common'
import { JIRA_USERS_PAGE, PERMISSION_SCHEME_TYPE_NAME } from '../constants'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { createIdToUserMap } from '../filters/account_id/add_display_name_filter'
import { wrongUsersPermissionSchemePredicateCreator } from '../filters/permission_scheme/wrong_users_permission_scheme_filter'

export const wrongUsersPermissionSchemeValidator: (
  client: JiraClient,
  config: JiraConfig,
  paginator: clientUtils.Paginator) =>
  ChangeValidator = (client, config, paginator) => async changes => {
    if (!(config.fetch.showUserDisplayNames ?? true)) {
      return []
    }
    const { baseUrl } = client
    const idMap = await createIdToUserMap(paginator)
    return changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(element => element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME
        && element.value.permissions !== undefined)
      .flatMap(element => element.value.permissions.flatMap((permission: PermissionHolder) => (
        wrongUsersPermissionSchemePredicateCreator(idMap)(permission)
          ? {
            elemID: element.elemID,
            severity: 'Warning' as SeverityLevel,
            message: 'The account id in a permission scheme does not exist. The element will be deployed without this permission scheme.',
            detailedMessage: `The account id “${permission.holder.parameter.id}” does not exist.
The Permission Scheme “${element.elemID.createTopLevelParentID().parent.name}” will be deployed without the permission containing it.
Check ${new URL(JIRA_USERS_PAGE, baseUrl).href} to see valid users and account IDs.`,
          } : [])))
  }
