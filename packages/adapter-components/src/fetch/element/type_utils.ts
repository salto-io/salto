/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  BUILTIN_TYPE_NAMES,
  Field,
  FieldDefinition,
  GENERIC_ID_PREFIX,
  GENERIC_ID_SUFFIX,
  InstanceElement,
  LIST_ID_PREFIX,
  ListType,
  MAP_ID_PREFIX,
  MapType,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  TypeElement,
  Values,
  createRefToElmWithValue,
  createRestriction,
  isEqualElements,
  isPrimitiveType,
  isTypeReference,
  isElement,
  getDeepInnerTypeSync,
} from '@salto-io/adapter-api'
import {
  TransformFuncSync,
  getSubtypes,
  inspectValue,
  transformValuesSync,
  ImportantValue,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'
import { FetchApiDefinitionsOptions } from '../../definitions/system/fetch'
import { generateType } from './type_element'

const { isDefined } = lowerdashValues
const log = logger(module)

export class InvalidSingletonType extends Error {}

export const NESTING_SEPARATOR = '__'

export const toNestedTypeName = (parentName: string, nestedTypeName: string): string =>
  `${parentName}${NESTING_SEPARATOR}${nestedTypeName}`

export const recursiveNestedTypeName = (typeName: string, ...fields: string[]): string =>
  fields.reduce(toNestedTypeName, typeName)

/**
 * calculate mapping from original type name to new type name. there are two ways to rename a type:
 * - using sourceTypeName on the new type name, saying which original type name it should be renamed from
 * - when extracting a standalone field, the provided typename will be used as the extracted instances' type
 *   (and the referring field's type as well)
 */
export const computeTypesToRename = <Options extends FetchApiDefinitionsOptions>({
  defQuery,
  typeNameOverrides,
}: {
  defQuery: ElementAndResourceDefFinder<Options>
  typeNameOverrides?: Record<string, string>
}): Record<string, string> =>
  typeNameOverrides ??
  _.merge(
    _.invert(
      _.pickBy(
        _.mapValues(defQuery.getAll(), def => def.element?.sourceTypeName),
        isDefined,
      ),
    ),
    Object.fromEntries(
      Object.entries(
        _.pickBy(defQuery.getAll(), def =>
          Object.values(def.element?.fieldCustomizations ?? {}).some(val => val.standalone?.typeName),
        ),
      ).flatMap(([typeName, def]) =>
        Object.entries(def.element?.fieldCustomizations ?? {})
          .map(([fieldName, { standalone }]) => {
            if (standalone?.typeName !== undefined) {
              return [toNestedTypeName(typeName, fieldName), standalone.typeName]
            }
            return undefined
          })
          .filter(isDefined),
      ),
    ),
  )

export const toPrimitiveType = (val: string): PrimitiveType =>
  _.get(
    {
      string: BuiltinTypes.STRING,
      boolean: BuiltinTypes.BOOLEAN,
      number: BuiltinTypes.NUMBER,
    },
    val,
    BuiltinTypes.UNKNOWN,
  )

/**
 * Helper function for creating the right type element from the type name specified in the config.
 * This can be called recursively to generate the right type from existing types, potentially
 * wrapped in containers - such as list<map<list<someTypeName>>>
 */
export const getContainerForType = (
  typeName: string,
):
  | {
      container: 'list' | 'map'
      typeNameSubstring: string
    }
  | undefined => {
  if (
    typeName.toLowerCase().startsWith(`${LIST_ID_PREFIX.toLowerCase()}${GENERIC_ID_PREFIX}`) &&
    typeName.endsWith(GENERIC_ID_SUFFIX)
  ) {
    return {
      container: 'list',
      typeNameSubstring: typeName.substring(
        LIST_ID_PREFIX.length + GENERIC_ID_PREFIX.length,
        typeName.length - GENERIC_ID_SUFFIX.length,
      ),
    }
  }
  if (typeName.toLowerCase().startsWith(MAP_ID_PREFIX.toLowerCase()) && typeName.endsWith(GENERIC_ID_SUFFIX)) {
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

const toTypeWithContainers = ({
  definedTypes,
  typeName,
}: {
  definedTypes: Record<string, ObjectType>
  typeName: string
}): TypeElement => {
  const containerDetails = getContainerForType(typeName)
  if (containerDetails?.container === 'list') {
    return new ListType(toTypeWithContainers({ definedTypes, typeName: containerDetails.typeNameSubstring }))
  }
  if (containerDetails?.container === 'map') {
    return new MapType(toTypeWithContainers({ definedTypes, typeName: containerDetails.typeNameSubstring }))
  }
  const type = definedTypes[typeName] ?? toPrimitiveType(typeName)
  if (isEqualElements(type, BuiltinTypes.UNKNOWN) && typeName.toLowerCase() !== 'unknown') {
    log.warn('could not find type %s, falling back to unknown', typeName)
  }
  return type
}

const overrideFieldType = ({
  type,
  fieldName,
  fieldTypeName,
  definedTypes,
}: {
  type: ObjectType
  fieldName: string
  fieldTypeName: string
  definedTypes: Record<string, ObjectType>
}): void => {
  const newFieldType = toTypeWithContainers({ definedTypes, typeName: fieldTypeName })
  if (type.fields[fieldName] === undefined) {
    log.debug('Creating field type for %s.%s with type %s', type.elemID.name, fieldName, newFieldType.elemID.name)
    type.fields[fieldName] = new Field(type, fieldName, newFieldType)
  }
  const field = type.fields[fieldName]
  log.debug(
    'Modifying field type for %s.%s from %s to %s',
    type.elemID.name,
    fieldName,
    field.refType.elemID.name,
    newFieldType.elemID.name,
  )
  field.refType = createRefToElmWithValue(newFieldType)
}

/**
 * Change field type to be service_id if it match the specified configuration.
 */
export const markServiceIdField = (
  fieldName: string,
  typeFields: Record<string, FieldDefinition | Field>,
  typeName: string,
): void => {
  const field = Object.prototype.hasOwnProperty.call(typeFields, fieldName) ? typeFields[fieldName] : undefined
  if (field === undefined) {
    return
  }
  log.debug('Mark field %s.%s as service_id', typeName, fieldName)
  const fieldType = isTypeReference(field.refType) ? field.refType.type : field.refType

  if (!isPrimitiveType(fieldType)) {
    log.warn('field %s.%s type is not primitive, cannot mark it as service_id', typeName, fieldName)
    return
  }
  switch (fieldType.primitive) {
    case PrimitiveTypes.NUMBER:
      field.refType = createRefToElmWithValue(BuiltinTypes.SERVICE_ID_NUMBER)
      return
    case PrimitiveTypes.STRING:
      field.refType = createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
      return
    default:
      log.warn(
        'Failed to mark field %s.%s as service id, since its primitive type id (%d) is not supported',
        typeName,
        fieldName,
        fieldType.primitive,
      )
  }
}

// Verify that field is not undefined if it is a serviceId or field we want to hide.
// This is to prevent writing to nacl (copyFromResponse on deployment) fields that supposed to be hidden.
const overrideServiceIdOrHiddenFieldIfNotDefined = ({
  definedTypes,
  type,
  fieldName,
  isServiceIdField,
  isHiddenField,
}: {
  definedTypes: Record<string, ObjectType>
  type: ObjectType
  fieldName: string
  isServiceIdField?: boolean
  isHiddenField?: boolean
}): void => {
  if (type.fields[fieldName] === undefined) {
    if (isServiceIdField) {
      overrideFieldType({
        type,
        definedTypes,
        fieldName,
        fieldTypeName: BUILTIN_TYPE_NAMES.STRING, // fallback to string serviceId
      })
      return
    }
    if (isHiddenField) {
      overrideFieldType({ type, definedTypes, fieldName, fieldTypeName: BUILTIN_TYPE_NAMES.UNKNOWN })
    }
  }
}

/**
 * Adjust field types based on the defined customization.
 */
export const overrideFieldTypes = <Options extends FetchApiDefinitionsOptions>({
  definedTypes,
  defQuery,
  finalTypeNames,
}: {
  definedTypes: Record<string, ObjectType>
  defQuery: ElementAndResourceDefFinder<Options>
  finalTypeNames?: Set<string>
}): void =>
  log.timeDebug(() => {
    Object.entries(definedTypes).forEach(([typeName, type]) => {
      if (finalTypeNames?.has(typeName)) {
        log.trace('type %s is marked as final, not adjusting', type.elemID.getFullName())
        return
      }

      const { element: elementDef, resource: resourceDef } = defQuery.query(typeName) ?? {}

      Object.entries(elementDef?.fieldCustomizations ?? {}).forEach(([fieldName, customization]) => {
        const { fieldType, restrictions, hide } = customization
        if (fieldType !== undefined) {
          overrideFieldType({ type, definedTypes, fieldName, fieldTypeName: fieldType })
        }
        overrideServiceIdOrHiddenFieldIfNotDefined({
          definedTypes,
          type,
          fieldName,
          isServiceIdField: resourceDef?.serviceIDFields?.includes(fieldName),
          isHiddenField: hide,
        })
        if (type.fields[fieldName] === undefined) {
          return
        }
        if (restrictions) {
          log.trace('applying restrictions to field %s.%s', type.elemID.name, fieldName)
          type.fields[fieldName].annotate({ [CORE_ANNOTATIONS.RESTRICTION]: createRestriction(restrictions) })
        }
      })
      // mark service ids after applying field customizations, in order to set the right type
      // (serviceid for strings / serviceid_number for numbers)
      resourceDef?.serviceIDFields?.forEach(fieldName => markServiceIdField(fieldName, type.fields, typeName))
    })
  }, 'overrideFieldTypes')

/**
 * Hide and omit fields based on the defined customization.
 */
export const hideAndOmitFields = <Options extends FetchApiDefinitionsOptions>({
  definedTypes,
  defQuery,
  finalTypeNames,
}: {
  definedTypes: Record<string, ObjectType>
  defQuery: ElementAndResourceDefFinder<Options>
  finalTypeNames?: Set<string>
}): void =>
  log.timeDebug(() => {
    Object.entries(definedTypes).forEach(([typeName, type]) => {
      if (finalTypeNames?.has(typeName)) {
        log.trace('type %s is marked as final, not adjusting', type.elemID.getFullName())
        return
      }

      const { element: elementDef } = defQuery.query(typeName) ?? {}

      Object.entries(elementDef?.fieldCustomizations ?? {}).forEach(([fieldName, customization]) => {
        const field = type.fields[fieldName]
        if (field === undefined) {
          return
        }
        const { hide, standalone, omit } = customization
        if (hide) {
          log.trace('hiding field %s.%s', type.elemID.name, fieldName)

          field.annotate({ [CORE_ANNOTATIONS.HIDDEN_VALUE]: true })
        }
        if (omit || standalone?.referenceFromParent === false) {
          log.trace('omitting field %s.%s from type', type.elemID.name, fieldName)
          // the field's value is removed when constructing the value in extractStandaloneInstances
          delete type.fields[fieldName]
        }
      })
    })
  }, 'hideAndOmitFields')

/**
 * Get the field type of a deep-nested field in a given type.
 *
 * This function traverses the field path in the type and returns the type of the field at the end of the path.
 *
 * @param type  - the top level type to start the search from
 * @param fieldPath - the path to the field in the top-level type
 *
 * @throws Error if any field in the path has an unresolved type reference
 */
export const getTypeInPath = (
  type: ObjectType | undefined,
  fieldPath: string[],
): ObjectType | PrimitiveType | undefined => {
  if (type === undefined || fieldPath.length === 0) {
    return undefined
  }
  const [fieldName, ...restPath] = fieldPath
  const field = Object.prototype.hasOwnProperty.call(type.fields, fieldName) ? type.fields[fieldName] : undefined
  if (field === undefined) {
    log.warn('failed to find type for field %s in type %s', fieldName, type.elemID.getFullName())
    return undefined
  }

  const fieldType = getDeepInnerTypeSync(field.getTypeSync())
  if (fieldType === undefined) {
    log.warn('field %s in type %s is undefined', fieldName, type.elemID.getFullName())
    return undefined
  }
  if (restPath.length === 0) {
    return fieldType
  }
  if (isPrimitiveType(fieldType)) {
    log.warn(
      'field %s in type %s is a primitive type, but path still has elements (%s), cannot recurse further',
      fieldName,
      type.elemID.getFullName(),
      restPath.join('.'),
    )
    return undefined
  }
  return getTypeInPath(fieldType, restPath)
}

export const addImportantValues = <Options extends FetchApiDefinitionsOptions>({
  definedTypes,
  defQuery,
}: {
  definedTypes: Record<string, ObjectType>
  defQuery: ElementAndResourceDefFinder<Options>
}): void =>
  log.timeTrace(() => {
    Object.entries(definedTypes).forEach(([typeName, type]) => {
      const { element: elementDef } = defQuery.query(typeName) ?? {}

      // Only add important value definitions for fields that actually exist in the type. This is needed to support
      // adapters defining default important values, and have them apply only when relevant to the type at hand.
      const importantValues = (elementDef?.topLevel?.importantValues ?? []).filter(
        ({ value }: ImportantValue) => getTypeInPath(type, value.split('.')) !== undefined,
      )

      // If there are no important values, avoid the assignment entirely to avoid creating empty `annotations` objects
      // in NaCL files for types that don't have important values.
      if (_.isEmpty(importantValues)) {
        return
      }
      type.annotate({ [CORE_ANNOTATIONS.IMPORTANT_VALUES]: importantValues })
    })
  }, 'addImportantValues')

/**
 * Filter for types that are either used by instance or defined in fetch definitions
 */
export const getReachableTypes = <Options extends FetchApiDefinitionsOptions>({
  instances,
  types,
  defQuery,
}: {
  instances: InstanceElement[]
  types: ObjectType[]
  defQuery: ElementAndResourceDefFinder<Options>
}): ObjectType[] => {
  const rootTypeNames = new Set(defQuery.allKeys().concat(instances.map(inst => inst.elemID.typeName)))
  const rootTypes = types.filter(type => rootTypeNames.has(type.elemID.name))
  const rootTypesSubtypes = new Set(getSubtypes(rootTypes).map(type => type.elemID.name))

  return types.filter(type => rootTypeNames.has(type.elemID.name) || rootTypesSubtypes.has(type.elemID.name))
}

export const removeNullValuesTransformFunc: TransformFuncSync = ({ value }) => (value === null ? undefined : value)

export const removeNullValues = ({
  values,
  type,
  allowEmptyArrays = false,
  allowExistingEmptyObjects = false,
  allowAllEmptyObjects = false,
}: {
  values: Values
  type: ObjectType
  allowEmptyArrays?: boolean
  allowExistingEmptyObjects?: boolean
  allowAllEmptyObjects?: boolean
}): Values =>
  transformValuesSync({
    values,
    type,
    transformFunc: removeNullValuesTransformFunc,
    strict: false,
    allowEmptyArrays,
    allowExistingEmptyObjects,
    allowAllEmptyObjects,
  }) ?? {}

/**
 * Add empty object types for all types that can have instances in the workspace,
 *  even if no instances will be created for them in the current fetch.
 * This is needed because if instances are added / cloned from another environment,
 *  they need to have a type in order to be deployed.
 */
export const createRemainingTypes = <Options extends FetchApiDefinitionsOptions>({
  adapterName,
  definedTypes,
  defQuery,
}: {
  adapterName: string
  definedTypes: Record<string, ObjectType>
  defQuery: ElementAndResourceDefFinder<Options>
}): Record<string, ObjectType> => {
  const topLevelTypeNames = Object.keys(_.pickBy(defQuery.getAll(), def => def.element?.topLevel?.isTopLevel))
  const missingTypes = topLevelTypeNames.filter(typeName => !isElement(definedTypes[typeName]))
  if (missingTypes.length > 0) {
    log.debug('creating empty types for the %d types: %s', missingTypes.length, inspectValue(missingTypes))
  }
  return _.keyBy(
    missingTypes.map(
      typeName =>
        generateType({
          adapterName,
          defQuery,
          typeName,
          definedTypes,
          entries: [],
        }).type,
    ),
    type => type.elemID.name,
  )
}
