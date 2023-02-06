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
import { Change, ChangeDataType, isEqualValues } from '@salto-io/adapter-api'
import { UNSUPPORTED_PERMISSION_SCHEME } from '../../change_validators/sd_portals_permission_scheme'
import { FilterCreator } from '../../filter'
import { omitChanges, OmitChangesPredicate, PermissionHolder, addBackPermissions } from './omit_permissions_common'


const sdPermissionSchemePredicate: OmitChangesPredicate = (
  permissionScheme: PermissionHolder
) => isEqualValues(permissionScheme, UNSUPPORTED_PERMISSION_SCHEME)

const filter: FilterCreator = () => {
  let unsupportedPermissionSchemes: Record<string, PermissionHolder[]> = {}
  return ({
    name: 'permissionSchemeFilter',
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      unsupportedPermissionSchemes = omitChanges(changes, sdPermissionSchemePredicate)
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      addBackPermissions(changes, unsupportedPermissionSchemes)
    },
  })
}

export default filter
