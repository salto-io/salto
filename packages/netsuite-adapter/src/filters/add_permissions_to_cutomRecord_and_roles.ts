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
  AdditionChange,
  Element,
  InstanceElement,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isObjectTypeChange,
  isReferenceExpression,
  isModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType } from '../types'
import { ROLE, SCRIPT_ID } from '../constants'
import {
  CustomRecordTypePermission,
  PermissionObject,
  RolePermission,
  getPermissionsListPath,
  isRolePermissionObject,
} from '../custom_references/weak_references/permissions_references'

type ObjectTypeOrInstanceElement = ObjectType | InstanceElement

type RolePermissionWithReference = RolePermission & {
  permkey: ReferenceExpression
}

type CustomRecordTypePermissionWithReference = CustomRecordTypePermission & {
  permittedrole: ReferenceExpression
}

type PermissionWithReference = RolePermissionWithReference | CustomRecordTypePermissionWithReference

type AdditionOrModificationRelevantChange =
  | AdditionChange<ObjectTypeOrInstanceElement>
  | ModificationChange<ObjectTypeOrInstanceElement>

export const isCustomRecordTypePermissionObject = (obj: unknown): obj is CustomRecordTypePermission =>
  values.isPlainRecord(obj) &&
  (typeof obj.permittedrole === 'string' || isReferenceExpression(obj.permittedrole)) &&
  typeof obj.permittedlevel === 'string' &&
  (typeof obj.restriction === 'string' || obj.restriction === undefined)

const isPermissionObject = (obj: unknown): obj is PermissionObject =>
  isRolePermissionObject(obj) || isCustomRecordTypePermissionObject(obj)

const getPrimaryAttribute = (permission: PermissionObject): ReferenceExpression | string =>
  isRolePermissionObject(permission) ? permission.permkey : permission.permittedrole

const getReferenceAttribute = (permission: PermissionWithReference): ReferenceExpression =>
  isRolePermissionObject(permission) ? permission.permkey : permission.permittedrole

const getPermissionLevelAttribute = (permission: PermissionObject): ReferenceExpression | string =>
  isRolePermissionObject(permission) ? permission.permlevel : permission.permittedlevel

const getPermissionFieldPath = (elem: Element): string[] =>
  isInstanceElement(elem) ? ['value', ...getPermissionsListPath()] : ['annotations', ...getPermissionsListPath()]

const createRefFromObjectTypeOrInstanceElement = (elem: ObjectTypeOrInstanceElement): ReferenceExpression =>
  isInstanceElement(elem)
    ? new ReferenceExpression(elem.elemID.createNestedID(SCRIPT_ID), elem.value[SCRIPT_ID], elem)
    : new ReferenceExpression(elem.elemID.createNestedID('attr', SCRIPT_ID), elem.annotations[SCRIPT_ID], elem)

const createOppositePermission = (
  permission: PermissionObject,
  sourceObj: ObjectTypeOrInstanceElement,
): PermissionObject =>
  isRolePermissionObject(permission)
    ? ({
        permittedlevel: permission.permlevel,
        permittedrole: createRefFromObjectTypeOrInstanceElement(sourceObj),
        restriction: permission.restriction,
      } as CustomRecordTypePermission)
    : ({
        permkey: createRefFromObjectTypeOrInstanceElement(sourceObj),
        permlevel: permission.permittedlevel,
        restriction: permission.restriction,
      } as RolePermission)

const getPermissionsWithReference = (obj: ObjectTypeOrInstanceElement): Record<string, PermissionWithReference> => {
  const permissions = _.get(obj, getPermissionFieldPath(obj))
  const permissionsRecord: Record<string, unknown> = values.isPlainRecord(permissions) ? permissions : {}
  return _.pickBy(
    permissionsRecord,
    (value): value is PermissionWithReference =>
      isPermissionObject(value) && isReferenceExpression(getPrimaryAttribute(value)),
  )
}

const areSameReferenceExpressions = (ref1: ReferenceExpression, ref2: ReferenceExpression): boolean =>
  ref1.elemID.isEqual(ref2.elemID) && _.isEqual(ref1.value, ref2.value)

const areSamePermissionsWithReference = (
  permission1: PermissionWithReference,
  permission2: PermissionWithReference,
): boolean =>
  areSameReferenceExpressions(getReferenceAttribute(permission1), getReferenceAttribute(permission2)) &&
  getPermissionLevelAttribute(permission1) === getPermissionLevelAttribute(permission2) &&
  permission1.restriction === permission2.restriction

const containsPermission = (object: ObjectTypeOrInstanceElement, permissionName: string): boolean =>
  _.get(object, [...getPermissionFieldPath(object), permissionName]) !== undefined

const getSourceAndTargetNames = (
  permission: PermissionWithReference,
  sourceObj: ObjectTypeOrInstanceElement,
): { sourceName: string; targetName: string | undefined } => {
  const isRolePermission = isRolePermissionObject(permission)
  const refAttribute = getReferenceAttribute(permission)
  const sourceName = isRolePermission ? sourceObj.elemID.name : sourceObj.elemID.typeName
  const targetName = isRolePermission
    ? refAttribute.topLevelParent?.elemID.typeName
    : refAttribute.topLevelParent?.elemID.name
  return { sourceName, targetName }
}

const isModifiedPermission = (
  permissionName: string,
  permission: PermissionWithReference,
  beforePermissions: Record<string, PermissionWithReference>,
): boolean =>
  !(
    permissionName in beforePermissions &&
    areSamePermissionsWithReference(permission, beforePermissions[permissionName])
  )

const addPermission = (
  permissionName: string,
  permission: PermissionWithReference,
  sourceObj: ObjectTypeOrInstanceElement,
  targetChangesMap: Map<string, AdditionOrModificationRelevantChange>,
  beforePermissions: Record<string, PermissionWithReference>,
): void => {
  const { sourceName, targetName } = getSourceAndTargetNames(permission, sourceObj)
  const targetObjChange = targetName !== undefined ? targetChangesMap.get(targetName) : undefined
  if (targetObjChange === undefined) {
    return
  }
  if (
    isModifiedPermission(permissionName, permission, beforePermissions) ||
    !containsPermission(targetObjChange.data.after, sourceName)
  ) {
    _.set(
      targetObjChange.data.after,
      [...getPermissionFieldPath(targetObjChange.data.after), sourceName],
      createOppositePermission(permission, sourceObj),
    )
  }
}

const addPermissions = (
  sourceObjectsMap: Map<string, AdditionOrModificationRelevantChange>,
  targetObjectsMap: Map<string, AdditionOrModificationRelevantChange>,
): void =>
  sourceObjectsMap.forEach(sourceObjChange => {
    const afterPermissions = getPermissionsWithReference(sourceObjChange.data.after)
    const beforePermissions = isModificationChange(sourceObjChange)
      ? getPermissionsWithReference(sourceObjChange.data.before)
      : {}
    Object.keys(afterPermissions).forEach(permissionName => {
      addPermission(
        permissionName,
        afterPermissions[permissionName],
        sourceObjChange.data.after,
        targetObjectsMap,
        beforePermissions,
      )
    })
  })

const filterCreator: LocalFilterCreator = () => ({
  name: 'addPermissions',
  preDeploy: async changes => {
    const customRecordTypeChangedMap = new Map<string, AdditionOrModificationRelevantChange>(
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isObjectTypeChange)
        .filter(change => isCustomRecordType(change.data.after))
        .map(custRecordChange => [custRecordChange.data.after.elemID.typeName, custRecordChange]),
    )

    const roleChangesMap = new Map<string, AdditionOrModificationRelevantChange>(
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => change.data.after.elemID.typeName === ROLE)
        .map(change => [change.data.after.elemID.name, change]),
    )

    if (customRecordTypeChangedMap.size > 0 && roleChangesMap.size > 0) {
      // add permissions to custom record types
      addPermissions(roleChangesMap, customRecordTypeChangedMap)
      // add permissions to roles
      addPermissions(customRecordTypeChangedMap, roleChangesMap)
    }
  },
})

export default filterCreator
