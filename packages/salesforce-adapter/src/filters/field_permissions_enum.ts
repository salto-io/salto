/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
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
  ChangeDataType,
  Change,
  isInstanceChange,
  isMapType,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeDataSync } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  SALESFORCE,
  METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  TYPES_PATH,
  SUBTYPES_PATH,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
} from '../constants'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  isCustomObjectSync,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
} from './utils'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

const PERMISSIONS_TYPES = [PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE, MUTING_PERMISSION_SET_METADATA_TYPE]

const FIELD_PERMISSIONS = 'fieldPermissions'

type TypeWithFieldPermissions = ObjectType & {
  fields: {
    [FIELD_PERMISSIONS]: Field
  }
}

const isTypeWithFieldPermissions = (elem: ObjectType): elem is TypeWithFieldPermissions =>
  Object.prototype.hasOwnProperty.call(elem.fields, FIELD_PERMISSIONS)

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

const mapOfMapOfEnumFieldPermissions = createRefToElmWithValue(new MapType(new MapType(enumFieldPermissions)))

const mapOfProfileFieldLevelSecurity = createRefToElmWithValue(new MapType(new MapType(profileFieldLevelSecurity)))

const fieldPermissionsObjectToEnum = (fieldPermissionsObject: FieldPermissionObject): FieldPermissionEnum => {
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
      log.warn(
        'Deploying unexpected value as fieldPermission for field %s, NaCL value is - %s',
        fieldName,
        fieldPermissionEnum,
      )
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
  instance.value.fieldPermissions = _.mapValues(instance.value.fieldPermissions, objectPermission =>
    _.mapValues(objectPermission, fieldPermission => {
      if (
        _.isPlainObject(fieldPermission) &&
        _.isBoolean(fieldPermission.readable) &&
        _.isBoolean(fieldPermission.editable)
      ) {
        return fieldPermissionsObjectToEnum(fieldPermission)
      }
      return fieldPermission
    }),
  )
  return instance
}

const fieldPermissionValuesToObject = (instance: InstanceElement): InstanceElement => {
  if (!isValidFieldPermissions(instance)) {
    return instance
  }
  instance.value.fieldPermissions = _.mapValues(instance.value.fieldPermissions, (objectPermission, objectName) =>
    _.mapValues(objectPermission, (fieldPermissionValue, fieldName) =>
      permissionsEnumToObject(`${objectName}.${fieldName}`, fieldPermissionValue),
    ),
  )
  return instance
}

const fieldPermissionFieldToEnum = (objectType: ObjectType): void => {
  if (isTypeWithFieldPermissions(objectType)) {
    const fieldType = objectType.fields.fieldPermissions.getTypeSync()
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

const getInstanceChangesWithFieldPermissions = (
  changes: Change<ChangeDataType>[],
): (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceOfTypeChangeSync(...PERMISSIONS_TYPES))
    .filter(isInstanceChange)

let shouldRunDeployFilters: boolean

// The decision if to run the deploy filters is based on the fieldPermissions type
// which indicates if it this filter ran onFetch or not
const shouldRunDeployFiltersAccordingToInstanceType = (instanceType: ObjectType): boolean =>
  isTypeWithFieldPermissions(instanceType) &&
  instanceType.fields.fieldPermissions.getTypeSync().elemID.isEqual(mapOfMapOfEnumFieldPermissions.elemID)

const removeUnfethcedCustomObjects = (instance: InstanceElement, customObjects: string[]): void => {
  if (isValidFieldPermissions(instance)) {
    instance.value.fieldPermissions = _.pick(instance.value.fieldPermissions, customObjects)
  }
}

const filter: FilterCreator = ({ config }) => ({
  name: 'enumFieldPermissionsFilter',
  onFetch: async elements => {
    const relevantInstances = elements.filter(isInstanceOfTypeSync(...PERMISSIONS_TYPES))
    if (!config.fetchProfile.isFeatureEnabled('disablePermissionsOmissions')) {
      const customObjects = await awu(await buildElementsSourceForFetch(elements, config).getAll())
        .filter(isCustomObjectSync)
        .map(element => apiNameSync(element))
        .filter(isDefined)
        .toArray()
      relevantInstances.forEach(element => {
        removeUnfethcedCustomObjects(element, customObjects)
      })
    }
    relevantInstances.forEach(fieldPermissionValuesToEnum)
    elements
      .filter(isObjectType)
      .filter(type => PERMISSIONS_TYPES.includes(apiNameSync(type) ?? ''))
      .forEach(type => fieldPermissionFieldToEnum(type))
    elements.push(enumFieldPermissions)
  },
  preDeploy: async changes => {
    const instanceChangesWithFieldPermissions = getInstanceChangesWithFieldPermissions(changes)
    if (instanceChangesWithFieldPermissions.length === 0) {
      return
    }
    const instanceType = getChangeData(instanceChangesWithFieldPermissions[0]).getTypeSync()
    shouldRunDeployFilters = shouldRunDeployFiltersAccordingToInstanceType(instanceType)
    if (!shouldRunDeployFilters) {
      return
    }
    instanceChangesWithFieldPermissions.forEach(instanceChange =>
      applyFunctionToChangeDataSync(instanceChange, fieldPermissionValuesToObject),
    )
    instanceChangesWithFieldPermissions
      .map(getChangeData)
      .map(inst => inst.getTypeSync())
      .forEach(fieldPermissionsFieldToOriginalType)
  },
  onDeploy: async changes => {
    if (!shouldRunDeployFilters) {
      return
    }
    const instanceChangesWithFieldPermissions = getInstanceChangesWithFieldPermissions(changes)
    if (instanceChangesWithFieldPermissions.length === 0) {
      return
    }
    instanceChangesWithFieldPermissions.forEach(instanceChange =>
      applyFunctionToChangeDataSync(instanceChange, fieldPermissionValuesToEnum),
    )
    instanceChangesWithFieldPermissions
      .map(getChangeData)
      .map(inst => inst.getTypeSync())
      .forEach(fieldPermissionFieldToEnum)
  },
})

export default filter
