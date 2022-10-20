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
import { ChangeValidator, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, ReadOnlyElementsSource, SeverityLevel } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { PERMISSION_SCHEME_TYPE_NAME, PERMISSIONS } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

export const getAllowedPermissionTypes = async (
  elementSource: ReadOnlyElementsSource,
): Promise<string[]|undefined> => {
  const permissionListElementId = await elementSource.get(new ElemID('jira', PERMISSIONS, 'instance', ElemID.CONFIG_NAME))
  if (!permissionListElementId) {
    return undefined
  }
  return Object.values(
    (
    await elementSource.get(permissionListElementId)
    ).value.additionalProperties as { key: string }[]
  ).map(({ key }) => key)
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
  return `The permissions ${invalidPermissionTypes.join(', ')} in ${permissionScheme.elemID.getFullName()} does not exist in the current environment and will be excluded during deployment`
}

export const permissionTypeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.warn('Elements source was not passed to permissionTypeValidator. Skipping validator')
    return []
  }
  const allowedPermissionTypes = await getAllowedPermissionTypes(elementsSource)
  if (!allowedPermissionTypes) {
    log.warn('Could not find allowed permission types for permissionTypeValidator. Skipping validator')
    return []
  }
  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME)
    .filter(instance => hasInvalidPermissions(instance, allowedPermissionTypes))
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: 'Invalid permission type in permission scheme',
      detailedMessage: getInvalidPermissionErrorMessage(instance, allowedPermissionTypes),
    }))
    .toArray()
}
