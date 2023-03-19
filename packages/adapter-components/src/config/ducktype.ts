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
import { ObjectType, BuiltinTypes, FieldDefinition } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { AdapterApiConfig, createAdapterApiConfigType, UserFetchConfig, TypeConfig, TypeDefaultsConfig, validateSupportedTypes } from './shared'
import { TransformationConfig, TransformationDefaultConfig, createTransformationConfigTypes, validateTransoformationConfig, getTransformationConfigByType } from './transformation'
import { validateRequestConfig } from './request'

const { isDefined } = lowerDashValues

type DuckTypeTransformationExtra = {
  // types that contain a single object with dynamic keys (map type)
  hasDynamicFields?: boolean
  sourceTypeName?: string
}
export type DuckTypeTransformationConfig = TransformationConfig & DuckTypeTransformationExtra
export type DuckTypeTransformationDefaultConfig = (
  TransformationDefaultConfig & DuckTypeTransformationExtra
)

export type TypeDuckTypeConfig = TypeConfig<DuckTypeTransformationConfig>
export type TypeDuckTypeDefaultsConfig = TypeDefaultsConfig<DuckTypeTransformationDefaultConfig>
export type AdapterDuckTypeApiConfig = AdapterApiConfig<
  DuckTypeTransformationConfig, DuckTypeTransformationDefaultConfig
>

export const createDucktypeAdapterApiConfigType = ({
  adapter,
  additionalFields,
  additionalRequestFields,
  additionalTransformationFields,
}: {
  adapter: string
  additionalFields?: Record<string, FieldDefinition>
  additionalRequestFields?: Record<string, FieldDefinition>
  additionalTransformationFields?: Record<string, FieldDefinition>
}): ObjectType => {
  const transformationTypes = createTransformationConfigTypes(adapter, {
    hasDynamicFields: { refType: BuiltinTypes.BOOLEAN },
    sourceTypeName: { refType: BuiltinTypes.STRING },
    ...additionalTransformationFields,
  })
  return createAdapterApiConfigType({
    adapter,
    additionalRequestFields,
    transformationTypes,
    additionalFields,
  })
}

export const validateApiDefinitionConfig = (
  apiDefinitionConfigPath: string,
  adapterApiConfig: AdapterDuckTypeApiConfig,
): void => {
  validateRequestConfig(
    apiDefinitionConfigPath,
    adapterApiConfig.typeDefaults.request,
    _.pickBy(
      _.mapValues(adapterApiConfig.types, typeDef => typeDef.request),
      isDefined,
    ),
  )
  validateTransoformationConfig(
    apiDefinitionConfigPath,
    adapterApiConfig.typeDefaults.transformation,
    getTransformationConfigByType(adapterApiConfig.types),
  )
}

/**
 * Verify that all fetch types exist in the endpoint definitions.
 * Note: This validation is only relevant for ducktype adapters.
 */
export const validateFetchConfig = (
  fetchConfigPath: string,
  userFetchConfig: UserFetchConfig,
  adapterApiConfig: AdapterApiConfig,
): void => {
  validateSupportedTypes(
    fetchConfigPath,
    userFetchConfig,
    Object.keys(adapterApiConfig.supportedTypes)
  )
  validateSupportedTypes(fetchConfigPath, userFetchConfig, Object.keys(adapterApiConfig.types))
}
