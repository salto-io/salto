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

import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Value, isModificationChange } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { assertValue } from './generic'

const log = logger(module)

export type PermissionObject = {
  type: string
  principalId: string
  key: string
  targetType: string
}

export const isSpaceChange = ({ change }: definitions.deploy.ChangeAndContext): boolean => {
  if (!isModificationChange(change)) {
    return false
  }
  return !_.isEqual(_.omit(change.data.before.value, 'permissions'), _.omit(change.data.after.value, 'permissions'))
}

export const createPermissionUniqueKey = ({ type, principalId, key, targetType }: PermissionObject): string =>
  `${type}_${principalId}_${key}_${targetType}`

export const isPermissionObject = (value: unknown): value is PermissionObject =>
  _.isString(_.get(value, 'type')) &&
  _.isString(_.get(value, 'principalId')) &&
  _.isString(_.get(value, 'key')) &&
  _.isString(_.get(value, 'targetType'))

export const transformPermissionAndUpdateIdMap = (
  permission: Value,
  permissionInternalIdMap: Record<string, string>,
): PermissionObject | undefined => {
  // subject
  const type = _.get(permission, 'principal.type') ?? _.get(permission, 'subject.type')
  const principalId = _.get(permission, 'principal.id') ?? _.get(permission, 'subject.identifier')
  const key = _.get(permission, 'operation.key')
  const targetType = _.get(permission, 'operation.targetType') ?? _.get(permission, 'operation.target')
  const internalId = _.get(permission, 'id')
  if ([type, principalId, key, targetType].some(x => !_.isString(x)) || internalId === undefined) {
    log.warn('permission is not in expected format: %o, skipping', permission)
    return undefined
  }
  permissionInternalIdMap[createPermissionUniqueKey({ type, principalId, key, targetType })] = internalId.toString()
  return { type, principalId, key, targetType }
}

export const restructurePermissionsAndCreateInternalIdMap = (value: Record<string, Value>): void => {
  const permissions = _.get(value, 'permissions')
  if (!Array.isArray(permissions)) {
    log.warn('permissions is not an array: %o, skipping space adjust function', permissions)
    return
  }
  const permissionInternalIdMap: Record<string, string> = {}
  const transformedPermissions = permissions
    .map(per => transformPermissionAndUpdateIdMap(per, permissionInternalIdMap))
    .filter(values.isDefined)
  value.permissions = transformedPermissions
  value.permissionInternalIdMap = { ...permissionInternalIdMap }
}

export const spaceMergeAndTransformAdjust: definitions.AdjustFunction<{
  fragments: definitions.GeneratedItem[]
}> = item => {
  const value = assertValue(item.value)
  restructurePermissionsAndCreateInternalIdMap(value)
  return { value }
}
