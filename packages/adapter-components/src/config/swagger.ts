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
import _ from 'lodash'
import { ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, FieldDefinition, ListType } from '@salto-io/adapter-api'
import { types, values as lowerDashValues } from '@salto-io/lowerdash'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { AdapterApiConfig, createAdapterApiConfigType, TypeConfig, TypeDefaultsConfig, UserFetchConfig } from './shared'
import { createRequestConfigs, validateRequestConfig } from './request'
import { createTransformationConfigTypes, validateTransoformationConfig } from './transformation'
import { findDuplicates } from './validation_utils'

const { isDefined } = lowerDashValues

export type FieldOverrideConfig = {
  type?: string
  list?: boolean
}

type TypeNameOverrideConfig = {
  originalName: string
  newName: string
}

export type AdditionalTypeConfig = {
  typeName: string
  cloneFrom: string
}

export type SwaggerDefinitionBaseConfig = {
  url: string
  // rename types
  // NOTE: this applies everywhere and the old names will not be accessible
  typeNameOverrides?: TypeNameOverrideConfig[]
  // define new types that are cloned from existing types
  additionalTypes?: AdditionalTypeConfig[]
}

export type TypeSwaggerConfig = TypeConfig
export type RequestableTypeSwaggerConfig = types.PickyRequired<TypeSwaggerConfig, 'request'>
export type TypeSwaggerDefaultConfig = TypeDefaultsConfig

export type AdapterSwaggerApiConfig = AdapterApiConfig & {
  swagger: SwaggerDefinitionBaseConfig

  // if undefined - generate all types. if defined - should not be empty
  supportedTypes?: string[]
}
export type RequestableAdapterSwaggerApiConfig = AdapterSwaggerApiConfig & {
  types: Record<string, RequestableTypeSwaggerConfig>
}

const createSwaggerDefinitionsBaseConfigType = (
  adapter: string,
): ObjectType => {
  const typeNameOverrideConfig = new ObjectType({
    elemID: new ElemID(adapter, 'typeNameOverrideConfig'),
    fields: {
      originalName: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      newName: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const additionalTypeConfig = new ObjectType({
    elemID: new ElemID(adapter, 'additionalTypeConfig'),
    fields: {
      typeName: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      cloneFrom: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const baseConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'swaggerDefinitionBaseConfig'),
    fields: {
      url: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      typeNameOverrides: {
        refType: createRefToElmWithValue(new ListType(typeNameOverrideConfig)),
      },
      additionalTypes: {
        refType: createRefToElmWithValue(new ListType(additionalTypeConfig)),
      },
    },
  })
  return baseConfigType
}

export const createSwaggerAdapterApiConfigType = ({
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
  const requestTypes = createRequestConfigs(adapter, additionalRequestFields)
  const transformationTypes = createTransformationConfigTypes(
    adapter,
    additionalTransformationFields,
  )
  return createAdapterApiConfigType({
    adapter,
    requestTypes,
    transformationTypes,
    additionalFields: {
      ...additionalFields,
      swagger: {
        refType: createSwaggerDefinitionsBaseConfigType(adapter),
      },
      supportedTypes: { refType: new ListType(BuiltinTypes.STRING) },
    },
  })
}

export const validateApiDefinitionConfig = (
  apiDefinitionConfigPath: string,
  adapterApiConfig: AdapterSwaggerApiConfig,
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
    _.pickBy(
      _.mapValues(adapterApiConfig.types, typeDef => typeDef.transformation),
      isDefined,
    ),
  )
  // TODO after loading the swagger and parsing the types,
  // add change suggestions for values that catch nothing
  const typeNameOverrides = adapterApiConfig.swagger.typeNameOverrides ?? []
  const allRenamedTypes = typeNameOverrides.flat()
  const renameDuplicates = findDuplicates(allRenamedTypes.flatMap(t => [t.originalName, t.newName]))
  if (renameDuplicates.length > 0) {
    throw new Error(`Duplicate type names in ${apiDefinitionConfigPath}.typeNameOverrides: ${renameDuplicates}`)
  }
  const invalidTypeNames = new Set(typeNameOverrides.map(t => t.originalName))
  const explicitTypes = Object.keys(adapterApiConfig.types)
  const invalidTypes = explicitTypes.filter(r => invalidTypeNames.has(r))
  if (invalidTypes.length > 0) {
    throw new Error(`Invalid type names in ${apiDefinitionConfigPath}: ${[...invalidTypes].sort()} were renamed in ${apiDefinitionConfigPath}.typeNameOverrides`)
  }
}

/**
 * Verify that all fetch types are supported.
 * Note: This validation is only relevant for swagger adapters.
 */
export const validateFetchConfig = (
  fetchConfigPath: string,
  apiConfigPath: string,
  userFetchConfig: UserFetchConfig,
  adapterApiConfig: AdapterSwaggerApiConfig,
): void => {
  if (adapterApiConfig.supportedTypes !== undefined) {
    const supportedTypesNames = new Set(adapterApiConfig.supportedTypes)
    const invalidIncludedTypes = userFetchConfig.includeTypes.filter(
      name => !supportedTypesNames.has(name)
    )
    if (invalidIncludedTypes.length > 0) {
      throw Error(`Invalid type names in ${fetchConfigPath}.includeTypes: ${invalidIncludedTypes} are not listed as supported types in ${apiConfigPath}.supportedTypes.`)
    }
  }
}
