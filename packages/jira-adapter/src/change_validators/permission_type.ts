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
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  ReadOnlyElementsSource,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import { isEmpty } from 'lodash'
import { PERMISSION_SCHEME_TYPE_NAME, PERMISSIONS, JIRA } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)
const PERMISSION_ITEM_SCHEME = Joi.object({
  key: Joi.string().required(),
}).unknown(true)

const isPermissionItemScheme = createSchemeGuard<{ key: string }>(
  PERMISSION_ITEM_SCHEME,
  'Found an invalid permission item scheme',
)

export const getAllowedPermissionTypes = async (
  elementSource: ReadOnlyElementsSource,
): Promise<Set<string> | undefined> => {
  const permissionListElementId = await elementSource.get(new ElemID(JIRA, PERMISSIONS, 'instance', ElemID.CONFIG_NAME))
  if (!permissionListElementId) {
    return undefined
  }
  if (isInstanceElement(permissionListElementId)) {
    return new Set(
      Object.values(permissionListElementId.value.permissions ?? {})
        .filter(isPermissionItemScheme)
        .map(({ key }) => key),
    )
  }
  return undefined
}

const getInvalidPermissions = (permissionScheme: InstanceElement, allowedPermissions: Set<string>): string[] =>
  (permissionScheme.value.permissions ?? [])
    .map((permission: { permission: string }) => permission.permission)
    .filter((permission: string) => !allowedPermissions.has(permission))

const getInvalidPermissionErrorMessage = (
  permissionScheme: InstanceElement,
  allowedPermissions: Set<string>,
): string => {
  const invalidPermissionTypes = getInvalidPermissions(permissionScheme, allowedPermissions)
  return `The permissions ${invalidPermissionTypes.join(', ')} in ${permissionScheme.elemID.getFullName()} do not exist in the current environment and will be excluded during deployment`
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
    .filter(instance => !isEmpty(getInvalidPermissions(instance, allowedPermissionTypes)))
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: 'Invalid permission type in permission scheme',
      detailedMessage: getInvalidPermissionErrorMessage(instance, allowedPermissionTypes),
    }))
    .toArray()
}
