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
import { PERMISSION_SCHEME, PERMISSIONS } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

const getAllowedPermissionTypes = async (
  elementSource: ReadOnlyElementsSource,
): Promise<string[]> => {
  const permissionListInstance = await awu(await elementSource.list())
    .find(id => id.typeName === PERMISSIONS && id.idType === 'instance')
  if (!permissionListInstance) {
    log.warn('could not find permission list nacl.')
    return []
  }
  const something = await elementSource.get(permissionListInstance)
  return Object.values(something.value.additionalProperties as { key: string }[])
    .map(({ key }) => key)
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
  const invalidPermissionTypes = Array.from(new Set(permissionScheme.value.permissions
    .filter((permission: { permission: string }) =>
      !allowedPermissions.includes(permission.permission))
    .map((permission: { permission: string }) => permission.permission)))
  return `Could not deploy element ${permissionScheme.elemID.getFullName()} because it had invalid permissions: ${invalidPermissionTypes.join(', ')}`
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
