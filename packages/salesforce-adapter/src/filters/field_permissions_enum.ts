/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  InstanceElement,
  isObjectType,
  MapType,
  PrimitiveType,
  ElemID,
  PrimitiveTypes,
  CORE_ANNOTATIONS,
  createRestriction,
  createRefToElmWithValue,
  ObjectType,
  getChangeData,
  BuiltinTypes,
  isAdditionOrModificationChange,
  AdditionChange,
  ModificationChange,
  Field,
  isInstanceElement,
  ChangeDataType,
  Change,
  isInstanceChange,
  isMapType,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { apiName, isCustomObject } from '../transformers/transformer'
import {
  SALESFORCE,
  METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  TYPES_PATH,
  SUBTYPES_PATH,
  PERMISSION_SET_METADATA_TYPE,
} from '../constants'
import { buildElementsSourceForFetch, isInstanceOfType, isInstanceOfTypeChange } from './utils'

const { awu } = collections.asynciterable
const log = logger(module)

const metadataTypesWithFieldPermissions = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
]

const FIELD_PERMISSIONS = 'fieldPermissions'

type TypeWithFieldPermissions = ObjectType & {
  fields: {
    [FIELD_PERMISSIONS]: Field
  }
}

const isTypeWithFieldPermissions = (elem: ObjectType): elem is TypeWithFieldPermissions =>
  (Object.prototype.hasOwnProperty.call(elem.fields, FIELD_PERMISSIONS))

type FieldPermissionObject = {
  field: string
  editable: boolean
  readable: boolean
}

type FieldPermissionEnum = 'ReadOnly' | 'ReadWrite' | 'NoAccess'
const fieldPermissionsEnumStrings: FieldPermissionEnum[] = ['ReadOnly', 'ReadWrite', 'NoAccess']

export const enumFieldPermissions = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'FieldPermissionEnum'),
  primitive: PrimitiveTypes.STRING,
  annotations: {
    [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
      values: fieldPermissionsEnumStrings,
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

const mapOfMapOfEnumFieldPermissions = createRefToElmWithValue(
  new MapType(new MapType(enumFieldPermissions)),
)

const mapOfProfileFieldLevelSecurity = createRefToElmWithValue(
  new MapType(new MapType(profileFieldLevelSecurity)),
)

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
      log.warn('Deploying unexpected value as fieldPermission for field %s, NaCL value is - %s', fieldName, fieldPermissionEnum)
      return {
        field: fieldName,
        readable: false,
        editable: false,
      }
  }
}

const isValidFieldPermissions = (instance: InstanceElement): boolean => {
  const { fieldPermissions } = instance.value
  if (fieldPermissions === undefined) {
    log.warn('Instance of type %s does not have fieldPermissions value (as expected)', instance.elemID.typeName)
    return false
  }
  if (!_.isPlainObject(fieldPermissions)) {
    log.warn('Instance of type %s does not have fieldPermissions field as Map (as expected)', instance.elemID.typeName)
    return false
  }
  return true
}

const fieldPermissionValuesToEnum = (instance: InstanceElement): InstanceElement => {
  if (!isValidFieldPermissions(instance)) {
    return instance
  }
  instance.value.fieldPermissions = _.mapValues(
    instance.value.fieldPermissions,
    objectPermission => _.mapValues(
      objectPermission,
      fieldPermission => {
        if (_.isPlainObject(fieldPermission)
                && _.isBoolean(fieldPermission.readable) && _.isBoolean(fieldPermission.editable)) {
          return fieldPermissionsObjectToEnum(fieldPermission)
        }
        return fieldPermission
      }
    )
  )
  return instance
}

const fieldPermissionValuesToObject = (instance: InstanceElement): InstanceElement => {
  if (!isValidFieldPermissions(instance)) {
    return instance
  }
  instance.value.fieldPermissions = _.mapValues(
    instance.value.fieldPermissions,
    (objectPermission, objectName) => _.mapValues(
      objectPermission,
      (fieldPermissionValue, fieldName) => (
        permissionsEnumToObject(`${objectName}.${fieldName}`, fieldPermissionValue)
      )
    )
  )
  return instance
}

const fieldPermissionFieldToEnum = async (objectType: ObjectType): Promise<void> => {
  if (isTypeWithFieldPermissions(objectType)) {
    const fieldType = await objectType.fields.fieldPermissions.getType()
    if (!isMapType(fieldType)) {
      log.warn('Type %s does not have fieldPermissions field as Map (as expected)', objectType.elemID.typeName)
      return
    }
    objectType.fields.fieldPermissions.refType = mapOfMapOfEnumFieldPermissions
  }
}

const fieldPermissionsFieldToOriginalType = (objectType: ObjectType): void => {
  if (isTypeWithFieldPermissions(objectType)) {
    objectType.fields.fieldPermissions.refType = mapOfProfileFieldLevelSecurity
  }
}

const getInstanceChangesWithFieldPermissions = async (
  changes: Change<ChangeDataType>[],
):
Promise<(AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[]> => (awu(changes)
  .filter(isAdditionOrModificationChange)
  .filter(isInstanceOfTypeChange(...metadataTypesWithFieldPermissions))
  .filter(isInstanceChange)
  .toArray())

let shouldRunDeployFilters: boolean

// The decision if to run the deploy filters is based on the fieldPermissions type
// which indicates if it this filter ran onFetch or not
const shouldRunDeployFiltersAccordingToInstanceType = async (
  instanceType: ObjectType,
): Promise<boolean> =>
  (isTypeWithFieldPermissions(instanceType)
    && (await instanceType.fields.fieldPermissions.getType()).elemID
      .isEqual(mapOfMapOfEnumFieldPermissions.elemID))

const removeUnfethcedCustomObjects = (instance: InstanceElement, customObjects: string[]): void => {
  if (isValidFieldPermissions(instance)) {
    instance.value.fieldPermissions = _.pick(instance.value.fieldPermissions, customObjects)
  }
}

const filter: LocalFilterCreator = ({ config }) => ({
  name: 'enumFieldPermissionsFilter',
  onFetch: async elements => {
    log.info('Running fieldPermissionsEnum onFetch - reducing fieldPermissions size')
    const relevantInstances = await awu(elements)
      .filter(isInstanceElement)
      .filter(async element => isInstanceOfType(...metadataTypesWithFieldPermissions)(element))
      .toArray()
    if (relevantInstances.length === 0) {
      return
    }
    const elementSource = await buildElementsSourceForFetch(elements, config).getAll()
    const customObjects = await awu(elementSource)
      .filter(isCustomObject)
      .map(element => apiName(element))
      .toArray()
    relevantInstances.forEach(element => {
      removeUnfethcedCustomObjects(element, customObjects)
    })
    if (config.enumFieldPermissions === false) {
      return
    }
    log.info('fieldPermissionsEnum onFetch - converting fieldPermissions to enum')
    relevantInstances.forEach(element => {
      fieldPermissionValuesToEnum(element)
    })
    const relevantObjectTypes = await awu(elements)
      .filter(isObjectType)
      .filter(async element => metadataTypesWithFieldPermissions.includes(await apiName(element)))
      .toArray()
    if (relevantObjectTypes.length === 0) {
      return
    }
    relevantObjectTypes.forEach(async element => {
      await fieldPermissionFieldToEnum(element)
    })
    elements.push(enumFieldPermissions)
  },
  preDeploy: async changes => {
    const instanceChangesWithFieldPermissions = await getInstanceChangesWithFieldPermissions(
      changes,
    )
    if (instanceChangesWithFieldPermissions.length === 0) {
      return
    }
    const instanceType = await getChangeData(instanceChangesWithFieldPermissions[0]).getType()
    shouldRunDeployFilters = await shouldRunDeployFiltersAccordingToInstanceType(instanceType)
    if (!shouldRunDeployFilters) {
      return
    }
    log.info('Running enumFieldPermissions preDeploy')
    instanceChangesWithFieldPermissions.forEach(instanceChange => (
      applyFunctionToChangeData(
        instanceChange,
        fieldPermissionValuesToObject,
      )
    ))
    const instanceTypes = Object.values(
      await awu(instanceChangesWithFieldPermissions.map(getChangeData))
        .map(inst => inst.getType())
        .keyBy(type => apiName(type))
    )
    instanceTypes.forEach(fieldPermissionsFieldToOriginalType)
  },
  onDeploy: async changes => {
    if (!shouldRunDeployFilters) {
      return
    }
    const instanceChangesWithFieldPermissions = await getInstanceChangesWithFieldPermissions(
      changes,
    )
    if (instanceChangesWithFieldPermissions.length === 0) {
      return
    }
    log.info('Running enumFieldPermissions onDeploy')
    instanceChangesWithFieldPermissions.forEach(instanceChange => (
      applyFunctionToChangeData(
        instanceChange,
        fieldPermissionValuesToEnum,
      )
    ))
    const instanceTypes = Object.values(
      await awu(instanceChangesWithFieldPermissions.map(getChangeData))
        .map(inst => inst.getType())
        .keyBy(type => apiName(type))
    )
    instanceTypes.forEach(fieldPermissionFieldToEnum)
  },
})

export default filter
