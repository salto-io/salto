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
import {
  ElemID, ObjectType, BuiltinTypes, FieldDefinition, ListType, MapType, Field, CORE_ANNOTATIONS, ActionName,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import type { TransformationConfig, TransformationDefaultConfig } from './transformation'
import { createRequestConfigs, DeploymentRequestsByAction, FetchRequestConfig, FetchRequestDefaultConfig } from './request'

export const DEPLOYER_FALLBACK_VALUE = '##DEPLOYER##'

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

type FetchEntry<T extends Record<string, unknown> | undefined> = {
  type: string
  criteria?: T
}

export type UserFetchConfig<T extends Record<string, unknown> | undefined = undefined> = {
  include: FetchEntry<T>[]
  exclude: FetchEntry<T>[]
  hideTypes?: boolean
}

export type UserDeployConfig = {
  // Replace references for missing users during deploy with defaultMissingUserFallback value
  defaultMissingUserFallback?: string
}

export const createAdapterApiConfigType = ({
  adapter,
  additionalFields,
  additionalTypeFields,
  transformationTypes,
  additionalRequestFields,
  additionalActions,
}: {
  adapter: string
  additionalFields?: Record<string, FieldDefinition>
  additionalTypeFields?: Record<string, FieldDefinition>
  transformationTypes: { transformation: ObjectType; transformationDefault: ObjectType }
  additionalRequestFields?: Record<string, FieldDefinition>
  additionalActions?: string[]
}): ObjectType => {
  const requestTypes = createRequestConfigs(adapter, additionalRequestFields, additionalActions)
  const typeDefaultsConfigType = createMatchingObjectType<Partial<TypeDefaultsConfig>>({
    elemID: new ElemID(adapter, 'typeDefaultsConfig'),
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
    elemID: new ElemID(adapter, 'typesConfig'),
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
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  return adapterApiConfigType
}

export const createUserFetchConfigType = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
  fetchCriteriaType?: ObjectType,
): ObjectType => {
  const fetchEntryType = createMatchingObjectType<Omit<FetchEntry<undefined>, 'criteria'>>({
    elemID: new ElemID(adapter, 'FetchEntry'),
    fields: {
      type: {
        refType: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  if (fetchCriteriaType !== undefined) {
    fetchEntryType.fields.criteria = new Field(fetchEntryType, 'criteria', fetchCriteriaType)
  }

  return createMatchingObjectType<UserFetchConfig>({
    elemID: new ElemID(adapter, 'userFetchConfig'),
    fields: {
      include: {
        refType: new ListType(fetchEntryType),
        annotations: { _required: true },
      },
      exclude: {
        refType: new ListType(fetchEntryType),
        annotations: { _required: true },
      },
      hideTypes: { refType: BuiltinTypes.BOOLEAN },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
}

export const createUserDeployConfigType = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
): ObjectType => (
  createMatchingObjectType<UserDeployConfig>({
    elemID: new ElemID(adapter, 'userDeployConfig'),
    fields: {
      defaultMissingUserFallback: { refType: BuiltinTypes.STRING },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
)

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

/**
 * Verify defaultMissingUserFallback value in deployConfig is valid
 */
export const validateDeployConfig = (
  deployConfigPath: string,
  userDeployConfig: UserDeployConfig,
  userValidationFunc: (userValue: string) => boolean
): void => {
  const { defaultMissingUserFallback } = userDeployConfig
  if (defaultMissingUserFallback !== undefined && defaultMissingUserFallback !== DEPLOYER_FALLBACK_VALUE) {
    const isValidUserValue = userValidationFunc(defaultMissingUserFallback)
    if (!isValidUserValue) {
      throw Error(`Invalid user value in ${deployConfigPath}.defaultMissingUserFallback: ${defaultMissingUserFallback}. Value can be either ${DEPLOYER_FALLBACK_VALUE} or a valid user name`)
    }
  }
}
