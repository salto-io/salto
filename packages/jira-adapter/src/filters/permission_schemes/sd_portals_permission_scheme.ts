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
import { Change, ChangeDataType, isAdditionOrModificationChange, isInstanceChange, getChangeData, InstanceElement, isEqualValues } from '@salto-io/adapter-api'
import _ from 'lodash'
import { PermissionHolder, UNSUPPORTED_PERMISSION_SCHEME } from '../../change_validators/sd_portals_permission_scheme'
import { FilterCreator } from '../../filter'
import { isPermissionScheme } from './forbidden_permission_schemes'


const filter: FilterCreator = () => {
  const unsupportedPermissionSchemes: Record<string, InstanceElement> = {}
  return ({
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      changes.filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isPermissionScheme)
        .forEach((element: InstanceElement) =>
          _.remove(element.value.permissions,
            (permissionScheme: PermissionHolder) => {
              if (isEqualValues(permissionScheme, UNSUPPORTED_PERMISSION_SCHEME)) {
                unsupportedPermissionSchemes[element.elemID.getFullName()] = element.clone()
                return true
              }
              return false
            }))
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      changes.filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isPermissionScheme)
        .forEach((element: InstanceElement) => {
          if (unsupportedPermissionSchemes[element.elemID.getFullName()] !== undefined) {
            element.value.permissions = unsupportedPermissionSchemes[
              element.elemID.getFullName()].value.permissions
            delete unsupportedPermissionSchemes[element.elemID.getFullName()]
          }
        })
    },
  })
}

export default filter
