/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ElemID, ObjectType, BuiltinTypes, FieldDefinition, ListType, MapType, Field,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import type { TransformationConfig, TransformationDefaultConfig } from './transformation'
import { DeploymentRequestsByAction, FetchRequestConfig, FetchRequestDefaultConfig } from './request'

export type TypeConfig<T extends TransformationConfig = TransformationConfig> = {
  request?: FetchRequestConfig
  deployRequests?: DeploymentRequestsByAction
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
> = {
  apiVersion?: string
  typeDefaults: TypeDefaultsConfig<TD>
  types: Record<string, TypeConfig<T>>
  supportedTypes: Record<string, string[]>
}

type FetchEntry<T extends Record<string, unknown> | undefined> = {
  type: string
  criteria?: T
}

export type UserFetchConfig<T extends Record<string, unknown> | undefined = undefined> = {
  include: FetchEntry<T>[]
  exclude: FetchEntry<T>[]
}

export const createAdapterApiConfigType = ({
  adapter,
  additionalFields,
  additionalTypeFields,
  requestTypes,
  transformationTypes,
}: {
  adapter: string
  additionalFields?: Record<string, FieldDefinition>
  additionalTypeFields?: Record<string, FieldDefinition>
  requestTypes: {
    fetch: {
      request: ObjectType
      requestDefault: ObjectType
    }
    deployRequests: ObjectType
  }
  transformationTypes: { transformation: ObjectType; transformationDefault: ObjectType }
}): ObjectType => {
  const typeDefaultsConfigType = createMatchingObjectType<Partial<TypeDefaultsConfig>>({
    elemID: new ElemID(adapter, 'typeDefaultsConfig'),
    fields: {
      request: { refType: requestTypes.fetch.requestDefault },
      transformation: {
        refType: transformationTypes.transformationDefault,
      },
      ...additionalTypeFields,
    },
  })

  const typesConfigType = createMatchingObjectType<TypeConfig>({
    elemID: new ElemID(adapter, 'typesConfig'),
    fields: {
      request: { refType: requestTypes.fetch.request },
      deployRequests: {
        refType: requestTypes.deployRequests,
      },
      transformation: { refType: transformationTypes.transformation },
      ...additionalTypeFields,
    },
  })

  const adapterApiConfigType = createMatchingObjectType<Partial<AdapterApiConfig>>({
    elemID: new ElemID(adapter, 'adapterApiConfig'),
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
  })
  return adapterApiConfigType
}

export const createUserFetchConfigType = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
  fetchCriteriaType?: ObjectType,
): ObjectType => {
  const fetchEntryType = new ObjectType({
    elemID: new ElemID(adapter, 'FetchEntry'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
    },
  })

  if (fetchCriteriaType !== undefined) {
    fetchEntryType.fields.criteria = new Field(fetchEntryType, 'criteria', fetchCriteriaType)
  }

  return new ObjectType({
    elemID: new ElemID(adapter, 'userFetchConfig'),
    fields: {
      include: { refType: new ListType(fetchEntryType) },
      exclude: { refType: new ListType(fetchEntryType) },
      ...additionalFields,
    },
  })
}

export const getConfigWithDefault = <
  T extends TransformationConfig | FetchRequestConfig | undefined,
  S extends TransformationDefaultConfig | FetchRequestDefaultConfig
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
