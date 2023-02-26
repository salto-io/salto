
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
import { FieldDefinition, Field, CORE_ANNOTATIONS, TypeElement, isObjectType, isContainerType,
  getDeepInnerType, ObjectType, BuiltinTypes, createRestriction, createRefToElmWithValue, PrimitiveType, LIST_ID_PREFIX, GENERIC_ID_PREFIX, GENERIC_ID_SUFFIX, MAP_ID_PREFIX, ListType, MapType, isEqualElements, isPrimitiveType, PrimitiveTypes, isTypeReference } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import { FieldToHideType, FieldTypeOverrideType, getTypeTransformationConfig } from '../config/transformation'
import { SUBTYPES_PATH, TYPES_PATH } from './constants'
import { getSubtypes } from './subtypes'
import { TypeConfig, TypeDefaultsConfig } from '../config/shared'

const { awu } = collections.asynciterable

const log = logger(module)

/**
 * Annotate fields with _hidden_value=true if they match the specified configuration.
 */
export const hideFields = (
  fieldsToHide: FieldToHideType[],
  typeFields: Record<string, FieldDefinition | Field>,
  typeName: string,
): void => {
  fieldsToHide.forEach(({ fieldName, fieldType }) => {
    const field = Object.prototype.hasOwnProperty.call(typeFields, fieldName)
      ? typeFields[fieldName]
      : undefined
    if (field === undefined) {
      return
    }
    if (fieldType === undefined || fieldType === field.refType.elemID.name) {
      log.debug('Hiding values for field %s.%s', typeName, fieldName)
      field.annotations = {
        ...(field.annotations ?? {}),
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      }
    }
  })
}

/**
 * Change field type to be service_id if it match the specified configuration.
 */
export const markServiceIdField = (
  fieldName: string,
  typeFields: Record<string, FieldDefinition | Field>,
  typeName: string,
): void => {
  const field = Object.prototype.hasOwnProperty.call(typeFields, fieldName)
    ? typeFields[fieldName]
    : undefined
  if (field === undefined) {
    return
  }
  log.debug('Mark field %s.%s as service_id', typeName, fieldName)
  const fieldType = isTypeReference(field.refType)
    ? field.refType.type
    : field.refType

  if (!isPrimitiveType(fieldType)) {
    log.warn('field %s.%s type is not primitive, cannot mark it as service_id', typeName, fieldName)
    return
  }
  switch (fieldType.primitive) {
    case (PrimitiveTypes.NUMBER):
      field.refType = createRefToElmWithValue(BuiltinTypes.SERVICE_ID_NUMBER)
      return
    case (PrimitiveTypes.STRING):
      field.refType = createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
      return
    default:
      log.warn(
        'Failed to mark field %s.%s as service id, since its primitive type id (%d) is not supported',
        typeName, fieldName, fieldType.primitive
      )
  }
}

export const filterTypes = async (
  adapterName: string,
  allTypes: TypeElement[],
  typesToFilter: string[]
): Promise<TypeElement[]> => {
  const nameToType = _.keyBy(allTypes, type => type.elemID.name)

  const relevantTypes = typesToFilter.map(name => {
    const type = nameToType[name]
    if (type === undefined) {
      log.warn(`Data type '${name}' of adapter ${adapterName} does not exist`)
    }
    return type
  }).filter(values.isDefined)

  relevantTypes
    .filter(t => t.path === undefined)
    .forEach(t => { t.path = [adapterName, TYPES_PATH, t.elemID.name] })

  const innerObjectTypes = await awu(relevantTypes)
    .filter(isContainerType)
    .map(async type => getDeepInnerType(type))
    .filter(isObjectType)
    .toArray()

  const subtypes = await getSubtypes([...relevantTypes.filter(isObjectType), ...innerObjectTypes])
  subtypes
    .filter(t => t.path === undefined)
    .forEach(t => { t.path = [adapterName, TYPES_PATH, SUBTYPES_PATH, t.elemID.name] })

  return [...relevantTypes, ...subtypes]
}

/**
 * Helper function for creating the right type element from the type name specified in the config.
 * This can be called recursively to generate the right type from existing types, potentially
 * wrapped in containers - such as List<Map<List<someTypeName>>>
 */
export const getContainerForType = (typeName: string): {
  container: 'list' | 'map'
  typeNameSubstring: string
} | undefined => {
  if (
    typeName.toLowerCase().startsWith(`${LIST_ID_PREFIX.toLowerCase()}${GENERIC_ID_PREFIX}`)
    && typeName.endsWith(GENERIC_ID_SUFFIX)
  ) {
    return {
      container: 'list',
      typeNameSubstring: typeName.substring(
        LIST_ID_PREFIX.length + GENERIC_ID_PREFIX.length,
        typeName.length - GENERIC_ID_SUFFIX.length,
      ),
    }
  }
  if (
    typeName.toLowerCase().startsWith(MAP_ID_PREFIX.toLowerCase())
    && typeName.endsWith(GENERIC_ID_SUFFIX)
  ) {
    return {
      container: 'map',
      typeNameSubstring: typeName.substring(
        MAP_ID_PREFIX.length + GENERIC_ID_PREFIX.length,
        typeName.length - GENERIC_ID_SUFFIX.length,
      ),
    }
  }
  return undefined
}

export const fixFieldTypes = (
  definedTypes: Record<string, ObjectType>,
  typeConfig: Record<string, TypeConfig>,
  typeDefaultConfig: TypeDefaultsConfig,
  toPrimitiveType: (val: string) => PrimitiveType
): void => {
  const toTypeWithContainers = (typeName: string): TypeElement => {
    const containerDetails = getContainerForType(typeName)
    if (containerDetails?.container === 'list') {
      return new ListType(toTypeWithContainers(containerDetails.typeNameSubstring))
    }
    if (containerDetails?.container === 'map') {
      return new MapType(toTypeWithContainers(containerDetails.typeNameSubstring))
    }
    const type = definedTypes[typeName] ?? toPrimitiveType(typeName)
    if (isEqualElements(type, BuiltinTypes.UNKNOWN) && typeName.toLowerCase() !== 'unknown') {
      log.warn('could not find type %s, falling back to unknown', typeName)
    }
    return type
  }

  Object.keys(typeConfig)
    .filter(typeName =>
      getTypeTransformationConfig(
        typeName, typeConfig, typeDefaultConfig
      ).fieldTypeOverrides !== undefined)
    .forEach(typeName => {
      const type = definedTypes[typeName]
      if (type === undefined) {
        log.warn('type %s not found, cannot override its field types', typeName)
        return
      }
      const fieldTypeOverrides = getTypeTransformationConfig(
        typeName, typeConfig, typeDefaultConfig,
      ).fieldTypeOverrides as FieldTypeOverrideType[]
      fieldTypeOverrides.forEach(({ fieldName, fieldType, restrictions }) => {
        const field = type.fields[fieldName]
        const newFieldType = toTypeWithContainers(fieldType)
        const annotations = restrictions ? {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction(restrictions),
        } : {}
        if (field === undefined) {
          log.debug(
            'Creating field type for %s.%s with type %s with restrictions %o',
            typeName, fieldName, newFieldType.elemID.name, restrictions
          )
          type.fields[fieldName] = new Field(type, fieldName, newFieldType, annotations)
        } else {
          log.debug(
            'Modifying field type for %s.%s from %s to %s with restrictions %o',
            typeName, fieldName, field.refType.elemID.name, newFieldType.elemID.name, restrictions
          )
          field.refType = createRefToElmWithValue(newFieldType)
          field.annotations = { ...field.annotations, ...annotations }
        }
      })
    })
}
