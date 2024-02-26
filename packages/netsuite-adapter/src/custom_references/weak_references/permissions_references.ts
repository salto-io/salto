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
  ChangeError,
  FixElementsFunc,
  GetCustomReferencesFunc,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  ReferenceInfo,
  Value,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { CUSTOM_RECORD_TYPE, PERMISSIONS, ROLE, SCRIPT_ID } from '../../constants'
import { isCustomRecordType } from '../../types'

const { awu } = collections.asynciterable

export type RolePermissionObject = {
  permkey: string | ReferenceExpression
  permlevel: string
  restriction?: string
}

type CustomRecordPermissionObject = {
  permittedlevel: string
  permittedrole: string | ReferenceExpression
  restriction?: string
}

type permissionObject = RolePermissionObject | CustomRecordPermissionObject

type RoleOrCustomRecord = 'role' | 'customrecordtype'

export const isRolePermissionObject = (obj: unknown): obj is RolePermissionObject => {
  const returnVal =
    values.isPlainRecord(obj) &&
    (typeof obj.permkey === 'string' || isReferenceExpression(obj.permkey)) &&
    typeof obj.permlevel === 'string' &&
    (typeof obj.restriction === 'string' || obj.restriction === undefined)
  return returnVal
}

const isCustomRecordPermissionObject = (obj: unknown): obj is CustomRecordPermissionObject => {
  const returnVal =
    values.isPlainRecord(obj) &&
    (typeof obj.permittedrole === 'string' || isReferenceExpression(obj.permittedrole)) &&
    typeof obj.permittedlevel === 'string' &&
    (typeof obj.restriction === 'string' || obj.restriction === undefined)
  return returnVal
}

const isPermissionObject = (obj: unknown, permissionType: RoleOrCustomRecord): obj is permissionObject =>
  permissionType === ROLE ? isRolePermissionObject(obj) : isCustomRecordPermissionObject(obj)

export const getPermissionsListPath = (): string[] => [PERMISSIONS, 'permission']

const getPermissionWeakElementReferences = (
  roleOrCustomRecord: ObjectType | InstanceElement,
): Record<string, ReferenceExpression> => {
  const permissionRecord: Record<string, ReferenceExpression> = {}
  const listPathValue = _.get(
    isInstanceElement(roleOrCustomRecord) ? roleOrCustomRecord.value : roleOrCustomRecord.annotations,
    getPermissionsListPath(),
  )
  if (values.isPlainRecord(listPathValue)) {
    Object.entries(listPathValue).forEach(([key, value]) => {
      if (isRolePermissionObject(value) && isReferenceExpression(value.permkey)) {
        permissionRecord[key] = value.permkey
      } else if (isCustomRecordPermissionObject(value) && isReferenceExpression(value.permittedrole)) {
        permissionRecord[key] = value.permittedrole
      }
    })
  }
  return permissionRecord
}

const getWeakElementReferences = (roleOrCustomRecord: ObjectType | InstanceElement): ReferenceInfo[] => {
  const rolePermissionReferences = getPermissionWeakElementReferences(roleOrCustomRecord)
  const permissionPath = isInstanceElement(roleOrCustomRecord)
    ? getPermissionsListPath()
    : ['attr', ...getPermissionsListPath()]
  return Object.entries(rolePermissionReferences).flatMap(([name, referenceElement]) => ({
    source: roleOrCustomRecord.elemID.createNestedID(...permissionPath, name),
    target: referenceElement.elemID,
    type: 'weak' as const,
  }))
}

const isRoleOrCustomRecordElement = (element: Value): element is InstanceElement | ObjectType =>
  (isInstanceElement(element) && element.elemID.typeName === ROLE) ||
  (isObjectType(element) && isCustomRecordType(element))

/**
 * Marks each element reference in an order type as a weak reference.
 */
const getPermissionsReferences: GetCustomReferencesFunc = async elements =>
  elements.filter(isRoleOrCustomRecordElement).flatMap(getWeakElementReferences)

const getValidPermissions = (
  permissionField: Record<string, unknown>,
  permissionType: RoleOrCustomRecord,
): Record<string, permissionObject> =>
  Object.entries(permissionField).reduce(
    (acc, [key, value]) => {
      if (isPermissionObject(value, permissionType)) {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, permissionObject>,
  )

const getFixedPermissionField = async (
  permissions: Record<string, unknown>,
  elementsSource: ReadOnlyElementsSource,
  permissionType: RoleOrCustomRecord,
): Promise<Record<string, permissionObject>> => {
  const validPermissions = getValidPermissions(permissions, permissionType)
  return awu(Object.entries(validPermissions)).reduce(
    async (acc, [key, value]) => {
      const permissionRefAttribute = isRolePermissionObject(value) ? value.permkey : value.permittedrole
      if (
        !isReferenceExpression(permissionRefAttribute) ||
        (await elementsSource.get(permissionRefAttribute.elemID.createTopLevelParentID().parent)) !== undefined
      ) {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, permissionObject>,
  )
}

const getFixedElementsAndUpdatedPaths = async (
  roleOrCustomRecord: InstanceElement | ObjectType,
  elementsSource: ReadOnlyElementsSource,
  permissionType: RoleOrCustomRecord,
): Promise<InstanceElement | ObjectType | undefined> => {
  const permissionField = _.get(
    isInstanceElement(roleOrCustomRecord) ? roleOrCustomRecord.value : roleOrCustomRecord.annotations,
    getPermissionsListPath(),
  )
  if (!values.isPlainRecord(permissionField)) {
    return undefined
  }

  const fixedPermissionField = await getFixedPermissionField(permissionField, elementsSource, permissionType)

  if (Object.keys(fixedPermissionField).length === Object.keys(permissionField).length) {
    return undefined
  }

  const fixedObject = roleOrCustomRecord.clone()
  _.set(
    isInstanceElement(fixedObject) ? fixedObject.value : fixedObject.annotations,
    getPermissionsListPath(),
    fixedPermissionField,
  )
  return fixedObject
}

const getMessageByPathAndElemTypeName = (
  elem: InstanceElement | ObjectType,
  fullPath: string,
  elementTypeName: string,
): ChangeError => ({
  elemID: elem.elemID,
  severity: 'Info',
  message: `Deploying ${fullPath} without all attached ${elementTypeName}`,
  detailedMessage: `This ${fullPath} is attached to some ${elementTypeName} that do not exist in the target environment. It will be deployed without referencing these ${elementTypeName}.`,
})

/**
 * Remove invalid references (not references or missing references) from order types.
 */
const removeMissingOrderElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const fixedRoles = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ROLE)
      .map(role => getFixedElementsAndUpdatedPaths(role, elementsSource, ROLE))
      .filter(isInstanceElement)
      .toArray()

    const roleErrors: ChangeError[] = fixedRoles.map(role => {
      const fullPath = `${role.value[SCRIPT_ID]}.${getPermissionsListPath().join('.')}`
      const elementTypeName = `${CUSTOM_RECORD_TYPE}s`
      return getMessageByPathAndElemTypeName(role, fullPath, elementTypeName)
    })

    const fixedCustomRecords = await awu(elements)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .map(custRecord => getFixedElementsAndUpdatedPaths(custRecord, elementsSource, CUSTOM_RECORD_TYPE))
      .filter(values.isDefined)
      .toArray()

    const customRecordErrors: ChangeError[] = fixedCustomRecords.map(custRecord => {
      const fullPath = `${custRecord.annotations.scriptid}.annotations.${getPermissionsListPath().join('.')}`
      const elementTypeName = `${ROLE}s`
      return getMessageByPathAndElemTypeName(custRecord, fullPath, elementTypeName)
    })

    return { fixedElements: [...fixedRoles, ...fixedCustomRecords], errors: [...roleErrors, ...customRecordErrors] }
  }

export const permissionsHandler: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}> = {
  findWeakReferences: getPermissionsReferences,
  removeWeakReferences: removeMissingOrderElements,
}
