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
import { BuiltinTypes, Field, FieldDefinition, GENERIC_ID_PREFIX, GENERIC_ID_SUFFIX, LIST_ID_PREFIX, MAP_ID_PREFIX, PrimitiveType, PrimitiveTypes, createRefToElmWithValue, isPrimitiveType, isTypeReference } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

const log = logger(module)

export const NESTING_SEPARATOR = '__'

export const toNestedTypeName = (parentName: string, nestedTypeName: string): string => (
  `${parentName}${NESTING_SEPARATOR}${nestedTypeName}`
)

export const toPrimitiveType = (val: string): PrimitiveType => _.get(
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
