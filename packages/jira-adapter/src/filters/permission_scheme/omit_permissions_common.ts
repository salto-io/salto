
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
import { Change, ChangeDataType, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isPermissionScheme } from './forbidden_permission_schemes'

export type PermissionHolder = {
  holder : { type: string; parameter?: Value }
  permission: string
}

export type OmitChangesPredicate = (permissionHolder: PermissionHolder) => boolean

export const omitChanges = (
  changes: Change<ChangeDataType>[],
  predicate: OmitChangesPredicate,
): Record<string, PermissionHolder[]> =>
  Object.fromEntries(
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isPermissionScheme)
      .map((element: InstanceElement) => {
        const temp: PermissionHolder[] = _.cloneDeep(element.value.permissions)
        _.remove(element.value.permissions, predicate)
        return [element.elemID.getFullName(), temp]
      })
  )

export const returnPermissions = (
  changes: Change<ChangeDataType>[],
  permissionsToReturn: Record<string, PermissionHolder[]>
): void => {
  changes.filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isPermissionScheme)
    .forEach((element: InstanceElement) => {
      if (permissionsToReturn[element.elemID.getFullName()] !== undefined) {
        element.value.permissions = permissionsToReturn[element.elemID.getFullName()]
      }
    })
}
