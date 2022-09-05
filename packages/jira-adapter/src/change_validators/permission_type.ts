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
import { ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, ReadOnlyElementsSource, SeverityLevel } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { PERMISSION_SCHEME } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

const getAllowedPermissionTypes = async (
  elementSource: ReadOnlyElementsSource,
): Promise<string[]> => {
  // eslint-disable-next-line no-console
  console.log(elementSource)
  return []
}

const hasInvalidPermissions = (
  permissionScheme: InstanceElement,
  allowedPermissions: string[],
): boolean =>
  permissionScheme.value.permissions.some(
    (permission: { permission: string }) => !allowedPermissions.includes(permission.permission)
  )

const getInvalidPermissionErrorMessage = (
  permissionScheme: InstanceElement,
  allowedPermissions: string[],
): string => {
  // eslint-disable-next-line no-console
  console.log(permissionScheme)
  // eslint-disable-next-line no-console
  console.log(allowedPermissions)
  return 'something'
}

export const permissionTypeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.warn('Elements source was not passed to permissionTypeValidator. Skipping validator')
    return []
  }
  const allowedPermissionTypes = await getAllowedPermissionTypes(elementsSource)
  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === PERMISSION_SCHEME)
    .filter(instance => hasInvalidPermissions(instance, allowedPermissionTypes))
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'invalid something something',
      detailedMessage: getInvalidPermissionErrorMessage(instance, allowedPermissionTypes),
    }))
    .toArray()
}
