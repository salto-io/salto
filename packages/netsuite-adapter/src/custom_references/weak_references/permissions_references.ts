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
  ElemID,
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
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { CUSTOM_RECORD_TYPE, PERMISSIONS, ROLE } from '../../constants'
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

type PermissionObject = RolePermissionObject | CustomRecordPermissionObject

type RoleOrCustomRecord = 'role' | 'customrecordtype'

const ROLE_PERMISSION_SCHEME = Joi.object({
  permkey: Joi.required(),
  permlevel: Joi.string().required(),
  restriction: Joi.string().optional(),
})

export const isRolePermissionObject = (val: Value): val is RolePermissionObject =>
  createSchemeGuard<RolePermissionObject>(ROLE_PERMISSION_SCHEME)(val) &&
  (isReferenceExpression(val.permkey) || _.isString(val.permkey))

const CUSTOM_RECORD_PERMISSION_SCHEME = Joi.object({
  permittedrole: Joi.required(),
  permittedlevel: Joi.string().required(),
  restriction: Joi.string().optional(),
})

const isCustomRecordPermissionObject = (val: Value): val is CustomRecordPermissionObject =>
  createSchemeGuard<CustomRecordPermissionObject>(CUSTOM_RECORD_PERMISSION_SCHEME)(val) &&
  (isReferenceExpression(val.permittedrole) || _.isString(val.permittedrole))

const isPermissionObject = (obj: unknown, permissionType: RoleOrCustomRecord): obj is PermissionObject =>
  permissionType === ROLE ? isRolePermissionObject(obj) : isCustomRecordPermissionObject(obj)

export const getPermissionsListPath = (): string[] => [PERMISSIONS, 'permission']

const getPermissionReferences = (
  roleOrCustomRecord: ObjectType | InstanceElement,
): Record<string, ReferenceExpression> => {
  const permissionReferences: Record<string, ReferenceExpression> = {}
  const listPathValue = _.get(
    isInstanceElement(roleOrCustomRecord) ? roleOrCustomRecord.value : roleOrCustomRecord.annotations,
    getPermissionsListPath(),
  )
  if (values.isPlainRecord(listPathValue)) {
    Object.entries(listPathValue).forEach(([key, value]) => {
      if (isRolePermissionObject(value) && isReferenceExpression(value.permkey)) {
        permissionReferences[key] = value.permkey
      } else if (isCustomRecordPermissionObject(value) && isReferenceExpression(value.permittedrole)) {
        permissionReferences[key] = value.permittedrole
      }
    })
  }
  return permissionReferences
}

const getWeakElementReferences = (roleOrCustomRecordType: ObjectType | InstanceElement): ReferenceInfo[] => {
  const permissionReferences = getPermissionReferences(roleOrCustomRecordType)
  const permissionPath = isInstanceElement(roleOrCustomRecordType)
    ? getPermissionsListPath()
    : ['attr', ...getPermissionsListPath()]
  return Object.entries(permissionReferences).flatMap(([name, referenceElement]) => ({
    source: roleOrCustomRecordType.elemID.createNestedID(...permissionPath, name),
    target: referenceElement.elemID,
    type: 'weak' as const,
  }))
}

const isRoleOrCustomRecordTypeElement = (element: Value): element is InstanceElement | ObjectType =>
  (isInstanceElement(element) && element.elemID.typeName === ROLE) ||
  (isObjectType(element) && isCustomRecordType(element))

const getPermissionsReferences: GetCustomReferencesFunc = async elements =>
  elements.filter(isRoleOrCustomRecordTypeElement).flatMap(getWeakElementReferences)

const getValidPermissions = (
  permissionField: Record<string, unknown>,
  permissionType: RoleOrCustomRecord,
): Record<string, PermissionObject> =>
  _.pickBy(permissionField, (value): value is PermissionObject => isPermissionObject(value, permissionType))

const getFixedPermissionField = async (
  permissions: Record<string, unknown>,
  elementsSource: ReadOnlyElementsSource,
  permissionType: RoleOrCustomRecord,
): Promise<Record<string, PermissionObject>> => {
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
    {} as Record<string, PermissionObject>,
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

const getMessageByPathAndElemTypeName = (elemID: ElemID, fullPath: string, elementTypeName: string): ChangeError => ({
  elemID,
  severity: 'Info',
  message: 'Deploying without all attached permissions',
  detailedMessage: `This ${fullPath} is referenced by certain ${elementTypeName} that do not exist in the target environment. As a result, it will be deployed without those references.`,
})

const removeUnresolvedPermissionElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const fixedRoles = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ROLE)
      .map(role => getFixedElementsAndUpdatedPaths(role, elementsSource, ROLE))
      .filter(values.isDefined)
      .toArray()

    const roleErrors: ChangeError[] = fixedRoles.map(role => {
      const fullPath = `${role.elemID.name}.${getPermissionsListPath().join('.')}`
      const elementTypeName = `${CUSTOM_RECORD_TYPE}s`
      return getMessageByPathAndElemTypeName(
        role.elemID.createNestedID(...getPermissionsListPath()),
        fullPath,
        elementTypeName,
      )
    })

    const fixedCustomRecordTypes = await awu(elements)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .map(custRecordType => getFixedElementsAndUpdatedPaths(custRecordType, elementsSource, CUSTOM_RECORD_TYPE))
      .filter(values.isDefined)
      .toArray()

    const customRecordTypeErrors: ChangeError[] = fixedCustomRecordTypes.map(custRecordType => {
      const fullPath = `${custRecordType.annotations.scriptid}.annotations.${getPermissionsListPath().join('.')}`
      const elementTypeName = `${ROLE}s`
      return getMessageByPathAndElemTypeName(
        custRecordType.elemID.createNestedID('annotation', ...getPermissionsListPath()),
        fullPath,
        elementTypeName,
      )
    })

    return {
      fixedElements: [...fixedRoles, ...fixedCustomRecordTypes],
      errors: [...roleErrors, ...customRecordTypeErrors],
    }
  }

export const permissionsHandler: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}> = {
  findWeakReferences: getPermissionsReferences,
  removeWeakReferences: removeUnresolvedPermissionElements,
}
