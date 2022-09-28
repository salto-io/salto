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
import { Change, ChangeDataType } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { createIdToUserMap, IdMap } from '../account_id/add_display_name_filter'
import { omitChanges, OmitChangesPredicate, returnPermissions, PermissionHolder } from './omit_permissions_common'


export const wrongUsersPermissionSchemePredicateCreator = (idMap: IdMap): OmitChangesPredicate =>
  (permissionScheme: PermissionHolder) => {
    const accountId = permissionScheme.holder?.parameter?.id
    return accountId !== undefined
    && !Object.prototype.hasOwnProperty.call(idMap, accountId)
  }

const filter: FilterCreator = ({ config, paginator }) => {
  let erroneousPermissionSchemes: Record<string, PermissionHolder[]> = {}
  return ({
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      if (!(config.fetch.showUserDisplayNames ?? true)) {
        return
      }
      const idMap = await createIdToUserMap(paginator)
      erroneousPermissionSchemes = omitChanges(
        changes,
        wrongUsersPermissionSchemePredicateCreator(idMap)
      )
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      returnPermissions(changes, erroneousPermissionSchemes)
    },
  })
}
export default filter
