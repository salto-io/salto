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
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { getAllowedPermissionTypes } from '../../change_validators/permission_type'
import { PermissionHolder, omitChanges, addBackPermissions } from './omit_permissions_common'

const log = logger(module)

const filter: FilterCreator = ({ elementsSource }) => {
  let unsupportedPermissionSchemes: Record<string, PermissionHolder[]> = {}
  return ({
    name: 'allowedPermissionsSchemeFilter',
    preDeploy: async changes => {
      const allowedPermissions = await getAllowedPermissionTypes(elementsSource)
      if (!allowedPermissions) {
        log.warn('Could not find allowed permission types for permission Scheme filter. skipping pre deploy permission scheme validations')
      } else {
        unsupportedPermissionSchemes = omitChanges(
          changes,
          (holder: PermissionHolder) => !allowedPermissions.has(holder.permission)
        )
      }
    },
    onDeploy: async changes => {
      addBackPermissions(changes, unsupportedPermissionSchemes)
    },
  })
}
export default filter
