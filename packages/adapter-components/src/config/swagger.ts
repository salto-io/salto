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
import { ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, FieldDefinition, ListType, ActionName } from '@salto-io/adapter-api'
import { types, collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { AdapterApiConfig, createAdapterApiConfigType, TypeConfig, TypeDefaultsConfig, UserFetchConfig, validateSupportedTypes } from './shared'
import { validateRequestConfig } from './request'
import { createTransformationConfigTypes, getTransformationConfigByType, TransformationConfig, TransformationDefaultConfig, validateTransoformationConfig } from './transformation'

const { isDefined } = lowerDashValues
const { findDuplicates } = collections.array

export type FieldOverrideConfig = {
  type?: string
  list?: boolean
}

export type TypeNameOverrideConfig = {
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

export type AdapterSwaggerApiConfig<A extends string = ActionName> = AdapterApiConfig<
 TransformationConfig, TransformationDefaultConfig, A> & {
  swagger: SwaggerDefinitionBaseConfig
}
export type RequestableAdapterSwaggerApiConfig = AdapterSwaggerApiConfig & {
  types: Record<string, RequestableTypeSwaggerConfig>
}

export const createTypeNameOverrideConfigType = (
  adapter: string,
): ObjectType => new ObjectType({
  elemID: new ElemID(adapter, 'typeNameOverrideConfig'),
  fields: {
    originalName: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    newName: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const createSwaggerDefinitionsBaseConfigType = (
  adapter: string,
): ObjectType => {
  const additionalTypeConfig = new ObjectType({
    elemID: new ElemID(adapter, 'additionalTypeConfig'),
    fields: {
      typeName: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      cloneFrom: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const baseConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'swaggerDefinitionBaseConfig'),
    fields: {
      url: {
        refType: BuiltinTypes.STRING,
      },
      typeNameOverrides: {
        refType: new ListType(createTypeNameOverrideConfigType(adapter)),
      },
      additionalTypes: {
        refType: new ListType(additionalTypeConfig),
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  return baseConfigType
}

export const createSwaggerAdapterApiConfigType = ({
  adapter,
  additionalFields,
  additionalTypeFields,
  additionalRequestFields,
  additionalTransformationFields,
  additionalActions,
}: {
  adapter: string
  additionalTypeFields?: Record<string, FieldDefinition>
  additionalFields?: Record<string, FieldDefinition>
  additionalRequestFields?: Record<string, FieldDefinition>
  additionalTransformationFields?: Record<string, FieldDefinition>
  additionalActions?: string[]
}): ObjectType => {
  const transformationTypes = createTransformationConfigTypes(
    adapter,
    additionalTransformationFields,
  )
  return createAdapterApiConfigType({
    adapter,
    transformationTypes,
    additionalTypeFields,
    additionalFields: {
      ...additionalFields,
      swagger: {
        refType: createSwaggerDefinitionsBaseConfigType(adapter),
      },
    },
    additionalRequestFields,
    additionalActions,
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
    getTransformationConfigByType(adapterApiConfig.types),
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
  userFetchConfig: UserFetchConfig,
  adapterApiConfig: AdapterSwaggerApiConfig,
): void => {
  validateSupportedTypes(
    fetchConfigPath,
    userFetchConfig,
    Object.keys(adapterApiConfig.supportedTypes)
  )
}
