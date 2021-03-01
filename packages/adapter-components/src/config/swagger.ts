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
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { AdapterApiConfig, createAdapterApiConfigType, TypeConfig, TypeDefaultsConfig } from './shared'
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

type AdditionalTypeConfig = {
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
export type TypeSwaggerDefaultConfig = TypeDefaultsConfig

export type AdapterSwaggerApiConfig = AdapterApiConfig & {
  swagger: SwaggerDefinitionBaseConfig
}

const createSwaggerDefinitionsBaseConfigType = (
  adapter: string,
): ObjectType => {
  const typeNameOverrideConfig = new ObjectType({
    elemID: new ElemID(adapter, 'typeNameOverrideConfig'),
    fields: {
      originalName: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      newName: {
        type: BuiltinTypes.STRING,
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
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      cloneFrom: {
        type: BuiltinTypes.STRING,
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
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      typeNameOverrides: {
        type: new ListType(typeNameOverrideConfig),
      },
      additionalTypes: {
        type: new ListType(additionalTypeConfig),
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
      swagger: { type: createSwaggerDefinitionsBaseConfigType(adapter) },
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
