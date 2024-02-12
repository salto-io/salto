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
import { ElemID, ObjectType, BuiltinTypes, FieldDefinition, ListType, MapType, CORE_ANNOTATIONS, ActionName,
  SeverityLevel } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import type { TransformationConfig, TransformationDefaultConfig } from './transformation'
import { createRequestConfigs, DeploymentRequestsByAction, FetchRequestConfig, FetchRequestDefaultConfig, getConfigTypeName } from './request'
import { UserFetchConfig } from '../definitions/user'

export class InvalidSingletonType extends Error {}

export class AdapterFetchError extends Error {
  constructor(message: string, readonly severity: SeverityLevel) {
    super(message)
  }
}

export type TypeConfig<T extends TransformationConfig = TransformationConfig, A extends string = ActionName> = {
  request?: FetchRequestConfig
  deployRequests?: DeploymentRequestsByAction<A>
  transformation?: T
}

export type TypeDefaultsConfig<
  TD extends TransformationDefaultConfig = TransformationDefaultConfig
> = {
  request?: FetchRequestDefaultConfig
  transformation: TD
}

export type AdapterApiConfig<
  T extends TransformationConfig = TransformationConfig,
  TD extends TransformationDefaultConfig = TransformationDefaultConfig,
  A extends string = ActionName,
> = {
  apiVersion?: string
  typeDefaults: TypeDefaultsConfig<TD>
  types: Record<string, TypeConfig<T, A>>
  supportedTypes: Record<string, string[]>
}

export const createAdapterApiConfigType = ({
  adapter,
  additionalFields,
  additionalTypeFields,
  transformationTypes,
  additionalRequestFields,
  additionalActions,
  elemIdPrefix = '',
}: {
  adapter: string
  additionalFields?: Record<string, FieldDefinition>
  additionalTypeFields?: Record<string, FieldDefinition>
  transformationTypes: { transformation: ObjectType; transformationDefault: ObjectType }
  additionalRequestFields?: Record<string, FieldDefinition>
  additionalActions?: string[]
  elemIdPrefix?: string
}): ObjectType => {
  const requestTypes = createRequestConfigs({
    adapter,
    additionalFields: additionalRequestFields,
    additionalActions,
    elemIdPrefix,
  })
  const typeDefaultsConfigType = createMatchingObjectType<Partial<TypeDefaultsConfig>>({
    elemID: new ElemID(adapter, getConfigTypeName(elemIdPrefix, 'typeDefaultsConfig')),
    fields: {
      request: { refType: requestTypes.fetch.requestDefault },
      transformation: {
        refType: transformationTypes.transformationDefault,
      },
      ...additionalTypeFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const typesConfigType = createMatchingObjectType<TypeConfig>({
    elemID: new ElemID(adapter, getConfigTypeName(elemIdPrefix, 'typesConfig')),
    fields: {
      request: { refType: requestTypes.fetch.request },
      deployRequests: {
        refType: requestTypes.deployRequests,
      },
      transformation: { refType: transformationTypes.transformation },
      ...additionalTypeFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })


  const adapterApiConfigType = createMatchingObjectType<Partial<AdapterApiConfig>>({
    elemID: new ElemID(adapter, getConfigTypeName(elemIdPrefix, 'adapterApiConfig')),
    fields: {
      types: {
        refType: new MapType(typesConfigType),
      },
      typeDefaults: {
        refType: typeDefaultsConfigType,
      },
      apiVersion: {
        refType: BuiltinTypes.STRING,
      },
      supportedTypes: {
        refType: new MapType(new ListType(BuiltinTypes.STRING)),
      },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  return adapterApiConfigType
}

export const defaultMissingUserFallbackField = { defaultMissingUserFallback: { refType: BuiltinTypes.STRING } }

export const getConfigWithDefault = <
  T extends TransformationConfig | FetchRequestConfig | TypeConfig | undefined,
  S extends TransformationDefaultConfig | FetchRequestDefaultConfig | TypeDefaultsConfig
>(
    typeSpecificConfig: T,
    defaultConfig: S,
  ): T & S => (
    _.defaults(
      {},
      typeSpecificConfig,
      defaultConfig,
    )
  )

/**
 * Verify that all fetch types are supported.
 */
export const validateSupportedTypes = (
  fetchConfigPath: string,
  userFetchConfig: UserFetchConfig,
  supportedTypesNames: string[],
): void => {
  const invalidIncludedTypes = [...userFetchConfig.include, ...userFetchConfig.exclude].filter(
    ({ type: typeRegex }) => supportedTypesNames.every(type => !new RegExp(`^${typeRegex}$`).test(type)),
  ).map(({ type }) => type)
  if (invalidIncludedTypes.length > 0) {
    throw Error(`Invalid type names in ${fetchConfigPath}: ${invalidIncludedTypes} does not match any of the supported types.`)
  }
}
