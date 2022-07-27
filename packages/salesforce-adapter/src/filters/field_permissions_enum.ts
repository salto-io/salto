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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { isInstanceElement, InstanceElement, isObjectType, MapType, PrimitiveType, ElemID, PrimitiveTypes, CORE_ANNOTATIONS, createRestriction, createRefToElmWithValue, TypeReference, ObjectType, getChangeData, BuiltinTypes, isAdditionOrModificationChange, AdditionChange, ModificationChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { SALESFORCE, METADATA_TYPE, PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE, TYPES_PATH, SUBTYPES_PATH } from '../constants'
import { isInstanceOfTypeChange } from './utils'

const { awu } = collections.asynciterable

const metadataTypesWithFieldPermissions = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
]

type FieldPermissionObject = {
  field: string
  editable: boolean
  readable: boolean
}

type FieldPermissionEnum = 'ReadOnly' | 'ReadWrite' | 'NoAccess'

export const enumFieldPermissions = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'FieldPermissionEnum'),
  primitive: PrimitiveTypes.STRING,
  annotations: {
    [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
      values: ['ReadOnly', 'ReadWrite', 'NoAccess'],
      enforce_value: true,
    }),
  },
  path: [SALESFORCE, TYPES_PATH, SUBTYPES_PATH, 'FieldPermissionEnum'],
})

export const profileFieldLevelSecurity = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'ProfileFieldLevelSecurity'),
  fields: {
    field: { refType: BuiltinTypes.STRING },
    editable: { refType: BuiltinTypes.BOOLEAN },
    readable: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [METADATA_TYPE]: 'ProfileFieldLevelSecurity',
  },
})

let mapOfMapOfEnumFieldPermissions: TypeReference

const getMapOfMapOfFieldPermissionEnum = (): TypeReference => {
  if (mapOfMapOfEnumFieldPermissions === undefined) {
    mapOfMapOfEnumFieldPermissions = createRefToElmWithValue(
      new MapType(new MapType(enumFieldPermissions)),
    )
  }
  return mapOfMapOfEnumFieldPermissions
}

let mapOfProfileFieldLevelSecurity: TypeReference

const getMapOfMapOfProfileFieldLevelSecurity = (): TypeReference => {
  if (mapOfProfileFieldLevelSecurity === undefined) {
    mapOfProfileFieldLevelSecurity = createRefToElmWithValue(
      new MapType(new MapType(profileFieldLevelSecurity)),
    )
  }
  return mapOfProfileFieldLevelSecurity
}

const fieldPermissionsObjectToEnum = (
  fieldPermissionsObject: FieldPermissionObject,
): FieldPermissionEnum => {
  if (fieldPermissionsObject.editable && fieldPermissionsObject.readable) {
    return 'ReadWrite'
  }
  if (fieldPermissionsObject.readable) {
    return 'ReadOnly'
  }
  return 'NoAccess'
}

const permissionsEnumToObject = (
  fieldName: string,
  fieldPermissionEnum: FieldPermissionEnum,
): FieldPermissionObject => {
  switch (fieldPermissionEnum) {
    case 'ReadWrite':
      return {
        field: fieldName,
        readable: true,
        editable: true,
      }
    case 'ReadOnly':
      return {
        field: fieldName,
        readable: true,
        editable: false,
      }
    case 'NoAccess':
      return {
        field: fieldName,
        readable: false,
        editable: false,
      }
    default:
      return {
        field: fieldName,
        readable: false,
        editable: false,
      }
  }
}

const fieldPermissionValuesToEnum = (instance: InstanceElement): InstanceElement => {
  const { fieldPermissions } = instance.value
  if (fieldPermissions === undefined) {
    return instance
  }
  instance.value.fieldPermissions = _.mapValues(
    fieldPermissions,
    objectPermission => _.mapValues(
      objectPermission,
      fieldPermission => {
        if (_.isBoolean(fieldPermission.readable) && _.isBoolean(fieldPermission.editable)) {
          return fieldPermissionsObjectToEnum(fieldPermission)
        }
        return fieldPermission
      }
    )
  )
  return instance
}

const fieldPermissionValuesToObject = (instance: InstanceElement): InstanceElement => {
  const { fieldPermissions } = instance.value
  if (fieldPermissions === undefined) {
    return instance
  }
  instance.value.fieldPermissions = _.mapValues(
    fieldPermissions,
    (objectPermission, objectName) => _.mapValues(
      objectPermission,
      (fieldPermissionValue, fieldName) => (
        permissionsEnumToObject(`${objectName}.${fieldName}`, fieldPermissionValue)
      )
    )
  )
  return instance
}

const fieldPermissionFieldToEnum = (objectType: ObjectType): void => {
  if (objectType.fields.fieldPermissions !== undefined) {
    objectType.fields.fieldPermissions.refType = getMapOfMapOfFieldPermissionEnum()
  }
}

const fieldPermissionsFieldToOriginalType = (objectType: ObjectType): void => {
  if (objectType.fields.fieldPermissions !== undefined) {
    objectType.fields.fieldPermissions.refType = getMapOfMapOfProfileFieldLevelSecurity()
  }
}

let shouldRunDeployFilters: boolean

const filter: LocalFilterCreator = ({ config }) => ({
  onFetch: async elements => {
    if (config.enumFieldPermissions === false) {
      return
    }
    await awu(metadataTypesWithFieldPermissions).forEach(async metadataType => {
      const type = await awu(elements).find(
        async element => isObjectType(element) && await apiName(element) === metadataType,
      ) as ObjectType
      if (type !== undefined) {
        fieldPermissionFieldToEnum(type)
      }
    })
    const instancesWithFieldPermissions = await awu(elements)
      .filter(async element => (
        isInstanceElement(element)
        && metadataTypesWithFieldPermissions.includes(await apiName(await element.getType()))))
      .toArray() as InstanceElement[]
    instancesWithFieldPermissions.forEach(fieldPermissionValuesToEnum)
    elements.push(enumFieldPermissions)
  },
  preDeploy: async changes => {
    await awu(metadataTypesWithFieldPermissions).forEach(async metadataType => {
      const instanceChanges = await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceOfTypeChange(metadataType))
        .toArray() as (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[]
      if (instanceChanges.length === 0) {
        return
      }
      const instanceType = await getChangeData(instanceChanges[0]).getType()
      shouldRunDeployFilters = instanceType.fields.fieldPermissions !== undefined
        && (await instanceType.fields.fieldPermissions.getType()).elemID
          .isEqual(getMapOfMapOfFieldPermissionEnum().elemID)
      if (!shouldRunDeployFilters) {
        return
      }
      instanceChanges.forEach(instanceChange => (
        applyFunctionToChangeData(
          instanceChange,
          fieldPermissionValuesToObject,
        )
      ))
      fieldPermissionsFieldToOriginalType(instanceType)
    })
  },
  onDeploy: async changes => {
    if (!shouldRunDeployFilters) {
      return
    }
    await awu(metadataTypesWithFieldPermissions).forEach(async metadataType => {
      const instanceChanges = await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceOfTypeChange(metadataType))
        .toArray() as (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[]
      if (instanceChanges.length === 0) {
        return
      }
      instanceChanges.forEach(instanceChange => (
        applyFunctionToChangeData(
          instanceChange,
          fieldPermissionValuesToEnum,
        )
      ))
      const instanceType = await getChangeData(instanceChanges[0]).getType()
      fieldPermissionFieldToEnum(instanceType)
    })
  },
})

export default filter
