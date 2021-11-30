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
import { ObjectType, BuiltinTypes, createRefToElmWithValue, MapType, ListType, TypeElement, isEqualElements, LIST_ID_PREFIX, GENERIC_ID_PREFIX, GENERIC_ID_SUFFIX, MAP_ID_PREFIX, ElemID, Field } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getConfigWithDefault } from '../../../config/shared'
import { TypeSwaggerConfig, AdditionalTypeConfig, TypeSwaggerDefaultConfig } from '../../../config/swagger'
import { FieldTypeOverrideType, FieldToHideType, TransformationConfig } from '../../../config/transformation'
import { toPrimitiveType } from './swagger_parser'
import { hideFields } from '../../type_elements'

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
 * Adjust the computed types based on the configuration in order to:
 *  1. Fix known inconsistencies between the swagger and the response data
 *  2. Hide field values that are known to be env-specific
 */
export const fixTypes = (
  definedTypes: Record<string, ObjectType>,
  typeConfig: Record<string, TypeSwaggerConfig>,
  typeDefaultConfig: TypeSwaggerDefaultConfig,
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

  const getTypeTransformationConfig = (typeName: string): TransformationConfig => (
    getConfigWithDefault(
      typeConfig[typeName]?.transformation,
      typeDefaultConfig.transformation,
    )
  )

  // fix field types
  Object.keys(typeConfig)
    .filter(typeName => getTypeTransformationConfig(typeName).fieldTypeOverrides !== undefined)
    .forEach(typeName => {
      const type = definedTypes[typeName]
      if (type === undefined) {
        log.warn('type %s not found, cannot override its field types', typeName)
        return
      }
      const fieldTypeOverrides = getTypeTransformationConfig(
        typeName
      ).fieldTypeOverrides as FieldTypeOverrideType[]
      fieldTypeOverrides.forEach(({ fieldName, fieldType }) => {
        const field = type.fields[fieldName]
        const newFieldType = toTypeWithContainers(fieldType)
        if (field === undefined) {
          log.debug('Creating field type for %s.%s with type %s', typeName, fieldName, newFieldType.elemID.name)
          type.fields[fieldName] = new Field(type, fieldName, newFieldType)
        } else {
          log.debug('Modifying field type for %s.%s from %s to %s', typeName, fieldName, field.refType.elemID.name, newFieldType.elemID.name)
          field.refType = createRefToElmWithValue(newFieldType)
        }
      })
    })

  // hide env-specific fields
  Object.entries(definedTypes)
    .filter(([typeName]) => getTypeTransformationConfig(typeName).fieldsToHide !== undefined)
    .forEach(([typeName, type]) => {
      hideFields(
        getTypeTransformationConfig(typeName).fieldsToHide as FieldToHideType[],
        type.fields,
        typeName,
      )
    })

  // update isSettings field in case of singleton
  Object.keys(typeConfig)
    .filter(typeName => getTypeTransformationConfig(typeName).isSingleton)
    .forEach(typeName => {
      const type = definedTypes[typeName]
      if (type !== undefined) {
        type.isSettings = true
      }
    })
}
