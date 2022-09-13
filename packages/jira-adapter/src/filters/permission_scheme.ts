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
import { Change, ChangeDataType, isAdditionOrModificationChange, isInstanceChange, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { permissionInterface, unsupportedPermissionScheme } from '../change_validators/permission_scheme'
import { FilterCreator } from '../filter'
import { isPermissionScheme } from './forbidden_permission_schemes'


const elementsWithUnsupportedPermissionSchemeMap = new Map<string, InstanceElement>()

const filter: FilterCreator = () => ({
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isPermissionScheme)
      .forEach((element: InstanceElement) =>
        _.remove(element.value.permissions,
          (permissionScheme: permissionInterface) => {
            if (_.isEqual(permissionScheme, unsupportedPermissionScheme)) {
              elementsWithUnsupportedPermissionSchemeMap
                .set(element.elemID.getFullName(), element.clone())
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
        if (elementsWithUnsupportedPermissionSchemeMap.has(element.elemID.getFullName())
          && element.value.permissions !== undefined) {
          element.value.permissions = elementsWithUnsupportedPermissionSchemeMap
            .get(element.elemID.getFullName())?.value.permissions
          elementsWithUnsupportedPermissionSchemeMap.delete(element.elemID.getFullName())
        }
      })
  },
})

export default filter
