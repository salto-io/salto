/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ObjectType, BuiltinTypes, MapType, ListType, TypeElement, isEqualElements, LIST_ID_PREFIX, GENERIC_ID_PREFIX, GENERIC_ID_SUFFIX, MAP_ID_PREFIX, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { TypeSwaggerConfig, AdditionalTypeConfig } from '../../../config/swagger'
import { FieldTypeOverrideType } from '../../../config/transformation'
import { toPrimitiveType } from './swagger_parser'

const log = logger(module)

/**
 * Helper function for creating the right type element from the type name specified in the config.
 * This can be called recursively to generate the right type from existing types, potentially
 * wrapped in containers - such as List<Map<List<someTypeName>>>
 */
const getContainerForType = (typeName: string): {
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
 * Define additional types/endpoints from config that were missing in the swagger.
 * Currently this only supports defining types based on existing types.
 */
export const defineAdditionalTypes = (
  adapterName: string,
  additionalTypes: AdditionalTypeConfig[],
  definedTypes: Record<string, ObjectType>,
  typeConfig: Record<string, TypeSwaggerConfig>,
): void => {
  additionalTypes.forEach(
    ({ typeName, cloneFrom }) => {
      const origType = definedTypes[cloneFrom]
      if (!origType) {
        throw new Error(`could not find type ${cloneFrom} needed for additional resource ${typeName}`)
      }
      const additionalType = new ObjectType({
        ...origType,
        elemID: new ElemID(adapterName, typeName),
      })
      definedTypes[typeName] = additionalType
      // the request should be defined directly in the type configuration
      if (typeConfig[typeName]?.request?.url === undefined) {
        log.error('Missing request url for cloned type %s', typeName)
      }
    }
  )
}

/**
 * Adjust the computed types to fix known inconsistencies between the swagger and the response data
 * that are listed in the configuration.
 */
export const fixTypes = (
  definedTypes: Record<string, ObjectType>,
  typeConfig: Record<string, TypeSwaggerConfig>
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
      log.error('could not find type %s, falling back to unknown', typeName)
    }
    return type
  }

  Object.keys(typeConfig)
    .filter(typeName => typeConfig[typeName].transformation?.fieldTypeOverrides !== undefined)
    .forEach(typeName => {
      const type = definedTypes[typeName]
      if (type === undefined) {
        log.error('type %s not found, cannot override its field types', typeName)
        return
      }
      const fieldTypeOverrides = typeConfig[
        typeName
      ].transformation?.fieldTypeOverrides as FieldTypeOverrideType[]
      fieldTypeOverrides.forEach(({ fieldName, fieldType }) => {
        const field = type.fields[fieldName]
        if (field === undefined) {
          log.error('field %s.%s not found, cannot override its type', typeName, fieldName)
          return
        }
        const newFieldType = toTypeWithContainers(fieldType)
        log.info('Modifying field type for %s.%s from %s to %s', typeName, fieldName, field.type.elemID.name, newFieldType.elemID.name)
        field.type = newFieldType
      })
    })
}
