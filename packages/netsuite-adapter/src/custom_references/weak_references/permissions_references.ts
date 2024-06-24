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
import { CUSTOM_RECORD_TYPE, PERMISSION, PERMISSIONS, ROLE } from '../../constants'
import { isCustomRecordType } from '../../types'

const { awu } = collections.asynciterable

export type RolePermission = {
  permkey: string | ReferenceExpression
  permlevel: string
  restriction?: string
}

export type CustomRecordTypePermission = {
  permittedlevel: string
  permittedrole: string | ReferenceExpression
  restriction?: string
}

export type PermissionObject = RolePermission | CustomRecordTypePermission

type RoleOrCustomRecordType = 'role' | 'customrecordtype'

const ROLE_PERMISSION_SCHEME = Joi.object({
  permkey: Joi.required(),
  permlevel: Joi.string().required(),
  restriction: Joi.string().optional(),
})

export const isRolePermissionObject = (val: Value): val is RolePermission =>
  createSchemeGuard<RolePermission>(ROLE_PERMISSION_SCHEME)(val) &&
  (isReferenceExpression(val.permkey) || _.isString(val.permkey))

const CUSTOM_RECORD_PERMISSION_SCHEME = Joi.object({
  permittedrole: Joi.required(),
  permittedlevel: Joi.string().required(),
  restriction: Joi.string().optional(),
})

const isCustomRecordTypePermissionObject = (val: Value): val is CustomRecordTypePermission =>
  createSchemeGuard<CustomRecordTypePermission>(CUSTOM_RECORD_PERMISSION_SCHEME)(val) &&
  (isReferenceExpression(val.permittedrole) || _.isString(val.permittedrole))

const isPermissionObject = (obj: unknown, permissionType: RoleOrCustomRecordType): obj is PermissionObject =>
  permissionType === ROLE ? isRolePermissionObject(obj) : isCustomRecordTypePermissionObject(obj)

export const getPermissionsListPath = (): string[] => [PERMISSIONS, PERMISSION]

const getPermissionReferences = (
  roleOrCustomRecordType: ObjectType | InstanceElement,
): Record<string, ReferenceExpression> => {
  const permissionReferences: Record<string, ReferenceExpression> = {}
  const listPathValue = _.get(
    isInstanceElement(roleOrCustomRecordType) ? roleOrCustomRecordType.value : roleOrCustomRecordType.annotations,
    getPermissionsListPath(),
  )
  if (values.isPlainRecord(listPathValue)) {
    Object.entries(listPathValue).forEach(([key, value]) => {
      if (isRolePermissionObject(value) && isReferenceExpression(value.permkey)) {
        permissionReferences[key] = value.permkey
      } else if (isCustomRecordTypePermissionObject(value) && isReferenceExpression(value.permittedrole)) {
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
  permissionType: RoleOrCustomRecordType,
): Record<string, PermissionObject> =>
  _.pickBy(permissionField, (value): value is PermissionObject => isPermissionObject(value, permissionType))

const getFixedPermissionField = async (
  permissions: Record<string, unknown>,
  elementsSource: ReadOnlyElementsSource,
  permissionType: RoleOrCustomRecordType,
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

const getFixedElement = async (
  roleOrCustomRecordType: InstanceElement | ObjectType,
  elementsSource: ReadOnlyElementsSource,
  permissionType: RoleOrCustomRecordType,
): Promise<InstanceElement | ObjectType | undefined> => {
  const permissionField = _.get(
    isInstanceElement(roleOrCustomRecordType) ? roleOrCustomRecordType.value : roleOrCustomRecordType.annotations,
    getPermissionsListPath(),
  )
  if (!values.isPlainRecord(permissionField)) {
    return undefined
  }

  const fixedPermissionField = await getFixedPermissionField(permissionField, elementsSource, permissionType)

  if (Object.keys(fixedPermissionField).length === Object.keys(permissionField).length) {
    return undefined
  }

  const fixedObject = roleOrCustomRecordType.clone()
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
      .map(role => getFixedElement(role, elementsSource, ROLE))
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
      .map(custRecordType => getFixedElement(custRecordType, elementsSource, CUSTOM_RECORD_TYPE))
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
