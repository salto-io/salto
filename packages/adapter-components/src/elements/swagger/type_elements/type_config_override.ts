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
import { ObjectType, ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { TypeSwaggerConfig, AdditionalTypeConfig, TypeSwaggerDefaultConfig } from '../../../config/swagger'
import { FieldToHideType, getTypeTransformationConfig } from '../../../config/transformation'
import { toPrimitiveType } from './swagger_parser'
import { hideFields, fixFieldTypes, getContainerForType } from '../../type_elements'
import { getConfigWithDefault } from '../../../config/shared'

const log = logger(module)
const { isDefined } = values

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
  fixFieldTypes(definedTypes, typeConfig, typeDefaultConfig, toPrimitiveType)

  // hide env-specific fields
  Object.entries(definedTypes)
    .filter(([typeName]) =>
      getTypeTransformationConfig(
        typeName, typeConfig, typeDefaultConfig
      ).fieldsToHide !== undefined)
    .forEach(([typeName, type]) => {
      hideFields(
        getTypeTransformationConfig(
          typeName, typeConfig, typeDefaultConfig
        ).fieldsToHide as FieldToHideType[],
        type.fields,
        typeName,
      )
    })

  // update isSettings field in case of singleton
  Object.keys(typeConfig)
    .filter(typeName => getTypeTransformationConfig(
      typeName, typeConfig, typeDefaultConfig
    ).isSingleton)
    .forEach(typeName => {
      const type = definedTypes[typeName]
      if (type !== undefined) {
        type.isSettings = true
      }
    })
}

/**
 * Get additional schemas from type names in FieldTypeOverrideType config
 */
export const getFieldTypeOverridesTypes = (
  typeConfig: Record<string, TypeSwaggerConfig>,
  typeDefaultConfig: TypeSwaggerDefaultConfig,
): Set<string> => {
  const primitiveTypeNames = new Set(Object.values(BuiltinTypes).map(type => type.elemID.name))
  const getInnerTypeName = (typeName: string): string => {
    const nestedTypeName = getContainerForType(typeName)
    return nestedTypeName === undefined ? typeName : getInnerTypeName(nestedTypeName.typeNameSubstring)
  }

  return new Set(Object.values(typeConfig)
    .map(config =>
      getConfigWithDefault(
        config.transformation, typeDefaultConfig.transformation
      ).fieldTypeOverrides)
    .filter(isDefined)
    .flatMap(fieldTypeOverrides => fieldTypeOverrides.map(field => getInnerTypeName(field.fieldType)))
    .filter(typeName => !primitiveTypeNames.has(typeName)))
}
