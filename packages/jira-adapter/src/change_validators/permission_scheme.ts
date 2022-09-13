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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { PERMISSION_SCHEME_TYPE_NAME } from '../constants'


const { awu } = collections.asynciterable

export interface permissionInterface {
    holder : { type: string; parameter?: string }
    permission: string
}

export const unsupportedPermissionScheme: permissionInterface = {
  holder: {
    type: 'sd.customer.portal.only',
  },
  permission: 'VIEW_AGGREGATED_DATA',
}

export const permissionSchemeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(element => element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME
      && element.value.permissions !== undefined)
    .filter(element =>
      element.value.permissions.filter((permission: permissionInterface) =>
        _.isEqual(permission, unsupportedPermissionScheme)).length !== 0)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: 'Cannot deploy the permission scheme permission',
      detailedMessage: `Cannot deploy the permission scheme ${instance.elemID.getFullName()} because the permission type "sd.customer.portal.only" is not allowed, keep deploying without it`,
    }))
    .toArray()
)
