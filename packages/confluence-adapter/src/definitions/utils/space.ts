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

import { definitions, deployment } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getChangeData, isAdditionChange, isInstanceElement, isReferenceExpression, Value } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { validateValue } from './generic'

const log = logger(module)

export type PermissionObject = {
  type: string
  principalId: string
  key: string
  targetType: string
}

export const createPermissionUniqueKey = ({ type, principalId, key, targetType }: PermissionObject): string =>
  `${type}_${principalId}_${key}_${targetType}`

export const isPermissionObject = (value: unknown): value is PermissionObject =>
  _.isString(_.get(value, 'type')) &&
  _.isString(_.get(value, 'principalId')) &&
  _.isString(_.get(value, 'key')) &&
  _.isString(_.get(value, 'targetType'))

/**
 * Restructures a single raw permission object from the service and updates permissionInternalIdMap with the relevant service id.
 * @param permission - raw permission from the service.
 * @param permissionInternalIdMap - serviceIds map to update.
 * @param onFetch - is raw permission came upon fetch or deploy (service returns different structures).
 */
export const transformPermissionAndUpdateIdMap = (
  permission: Value,
  permissionInternalIdMap: Record<string, string>,
  onFetch?: boolean,
): PermissionObject | undefined => {
  const type = onFetch ? _.get(permission, 'principal.type') : _.get(permission, 'subject.type')
  const principalId = onFetch ? _.get(permission, 'principal.id') : _.get(permission, 'subject.identifier')
  const key = _.get(permission, 'operation.key')
  const targetType = onFetch ? _.get(permission, 'operation.targetType') : _.get(permission, 'operation.target')
  const internalId = _.get(permission, 'id')
  if ([type, principalId, key, targetType].some(x => !_.isString(x)) || internalId === undefined) {
    log.warn('permission is not in expected format: %o, skipping', permission)
    return undefined
  }
  permissionInternalIdMap[createPermissionUniqueKey({ type, principalId, key, targetType })] = String(internalId)
  return { type, principalId, key, targetType }
}

/**
 * Restructures permissions array on space instance value and creates an internal ID map.
 * To be used on deploy. We need this as we cannot hide fields inside arrays
 * @param value - value containing raw permissions array from the service.
 */
export const restructurePermissionsAndCreateInternalIdMap = (value: Record<string, unknown>): void => {
  const permissions = _.get(value, 'permissions')
  if (!Array.isArray(permissions)) {
    log.warn('permissions is not an array: %o, skipping space adjust function', permissions)
    return
  }
  const permissionInternalIdMap: Record<string, string> = {}
  const transformedPermissions = permissions
    .map(per => transformPermissionAndUpdateIdMap(per, permissionInternalIdMap, true))
    .filter(values.isDefined)
  value.permissions = transformedPermissions
  value.permissionInternalIdMap = { ...permissionInternalIdMap }
}

/**
 * Adjust function for transforming space instances upon fetch.
 * We reconstruct the permissions so we use this function on resource and not on request.
 */
export const spaceMergeAndTransformAdjust: definitions.AdjustFunction<{
  fragments: definitions.GeneratedItem[]
}> = item => {
  const value = validateValue(item.value)
  restructurePermissionsAndCreateInternalIdMap(value)
  return { value }
}

/**
 * Group space with its homepage upon addition.
 * We want to first deploy the space, a default homepage will be created in the service. We want to modify it
 */
export const spaceChangeGroupWithItsHomepage: deployment.grouping.ChangeIdFunction = async change => {
  const changeData = getChangeData(change)
  if (isInstanceElement(changeData)) {
    const homepageRef = changeData.value.homepageId
    // in case of addition, we want the space to be in the same group as its homepage
    if (isAdditionChange(change) && isReferenceExpression(homepageRef)) {
      return homepageRef.elemID.getFullName()
    }
  }
  return changeData.elemID.getFullName()
}
