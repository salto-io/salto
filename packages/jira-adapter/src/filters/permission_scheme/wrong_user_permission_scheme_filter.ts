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
import { Change, ChangeDataType } from '@salto-io/adapter-api'
import { getUsersMap, getUsersMapByVisibleId, UserMap } from '../../users'
import { FilterCreator } from '../../filter'
import { omitChanges, OmitChangesPredicate, addBackPermissions, PermissionHolder } from './omit_permissions_common'


/**
 * A predicate that returns true if the permission scheme contains an account ID and it does not
 * exist in the provided idMap
 */
export const wrongUserPermissionSchemePredicateCreator = (userMap: UserMap): OmitChangesPredicate =>
  (permissionScheme: PermissionHolder) => {
    const accountId = permissionScheme.holder?.parameter?.id
    return accountId !== undefined
      && !Object.prototype.hasOwnProperty.call(userMap, accountId)
  }

/**
 * pre deploy removes permissions within a permission scheme that contain a wrong account id.
 * on deploy adds those permissions back
 */
const filter: FilterCreator = ({ config, client, elementsSource }) => {
  let erroneousPermissionSchemes: Record<string, PermissionHolder[]> = {}
  return ({
    name: 'wrongUserPermissionSchemeFilter',
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      if (!(config.fetch.convertUsersIds ?? true)) {
        return
      }
      const rawUserMap = await getUsersMap(elementsSource)
      if (rawUserMap === undefined) {
        return
      }
      const userMap = getUsersMapByVisibleId(rawUserMap, client.isDataCenter)

      erroneousPermissionSchemes = omitChanges(
        changes,
        wrongUserPermissionSchemePredicateCreator(userMap)
      )
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      addBackPermissions(changes, erroneousPermissionSchemes)
    },
  })
}
export default filter
