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
import _ from 'lodash'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Field,
  FieldDefinition,
  GENERIC_ID_PREFIX,
  GENERIC_ID_SUFFIX,
  LIST_ID_PREFIX,
  ListType,
  MAP_ID_PREFIX,
  MapType,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  TypeElement,
  createRefToElmWithValue,
  createRestriction,
  isEqualElements,
  isPrimitiveType,
  isTypeReference,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'

const { isDefined } = lowerdashValues
const log = logger(module)

export const NESTING_SEPARATOR = '__'

export const toNestedTypeName = (parentName: string, nestedTypeName: string): string =>
  `${parentName}${NESTING_SEPARATOR}${nestedTypeName}`

/**
 * calculate mapping from original type name to new type name. there are two ways to rename a type:
 * - using sourceTypeName on the new type name, saying which original type name it should be renamed from
 * - when extracting a standalone field, the provided typename will be used as the extracted instances' type
 *   (and the referring field's type as well)
 */
export const computeTypesToRename = ({
  defQuery,
  typeNameOverrides,
}: {
  defQuery: ElementAndResourceDefFinder
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

/**
 * Adjust field definitions based on the defined customization.
 */
export const adjustFieldTypes = ({
  definedTypes,
  defQuery,
  finalTypeNames,
}: {
  definedTypes: Record<string, ObjectType>
  defQuery: ElementAndResourceDefFinder
  finalTypeNames?: Set<string>
}): void => {
  Object.entries(definedTypes).forEach(([typeName, type]) => {
    if (finalTypeNames?.has(typeName)) {
      log.trace('type %s is marked as final, not adjusting', type.elemID.getFullName())
      return
    }

    const { element: elementDef, resource: resourceDef } = defQuery.query(typeName) ?? {}

    Object.entries(elementDef?.fieldCustomizations ?? {}).forEach(([fieldName, customization]) => {
      if (customization.fieldType !== undefined) {
        overrideFieldType({ type, definedTypes, fieldName, fieldTypeName: customization.fieldType })
      }
      const field = type.fields[fieldName]
      if (field === undefined) {
        log.debug('field %s.%s is undefined, not applying customizations', typeName, fieldName)
        return
      }
      const { hide, restrictions, standalone, omit } = customization
      if (restrictions) {
        log.debug('applying restrictions to field %s.%s', type.elemID.name, fieldName)
        field.annotate({ [CORE_ANNOTATIONS.RESTRICTION]: createRestriction(restrictions) })
      }
      if (hide) {
        log.debug('hiding field %s.%s', type.elemID.name, fieldName)

        field.annotate({ [CORE_ANNOTATIONS.HIDDEN_VALUE]: true })
      }
      if (omit || standalone?.referenceFromParent === false) {
        log.debug('omitting field %s.%s from type', type.elemID.name, fieldName)
        // the field's value is removed when constructing the value in extractStandaloneInstances
        delete type.fields[fieldName]
      }
    })
    // mark service ids after applying field customizations, in order to set the right type
    // (serviceid for strings / serviceid_number for numbers)
    resourceDef?.serviceIDFields?.forEach(fieldName => markServiceIdField(fieldName, type.fields, typeName))
  })
}
