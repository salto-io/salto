/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isPermissionSchemeStructure, PermissionHolder } from '../filters/permission_scheme/omit_permissions_common'
import { PERMISSION_SCHEME_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

export const UNSUPPORTED_PERMISSION_SCHEME: PermissionHolder = {
  holder: {
    type: 'sd.customer.portal.only',
  },
  permission: 'VIEW_AGGREGATED_DATA',
}

/**
 * Removes invalid permissions of type UNSUPPORTED_PERMISSION_SCHEME (see above) that fails deploy
 */
export const permissionSchemeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(
      element => element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME && element.value.permissions !== undefined,
    )
    .filter(
      element =>
        element.value.permissions.filter(
          (permission: PermissionHolder) =>
            isPermissionSchemeStructure(permission) && isEqualValues(permission, UNSUPPORTED_PERMISSION_SCHEME),
        ).length !== 0,
    )
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: 'Cannot deploy the permission scheme permission',
      detailedMessage: `Jira does not allow granting the permission 'VIEW_AGGREGATED_DATA' to 'sd.customer.portal.only'. The permission scheme ${instance.elemID.getFullName()} will be deployed without it`,
    }))
    .toArray()
