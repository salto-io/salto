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
import {
  ElemID, ObjectType, BuiltinTypes, FieldDefinition, ListType, MapType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { RequestConfig, RequestDefaultConfig } from './request'
import type { TransformationConfig, TransformationDefaultConfig } from './transformation'

export type TypeConfig<T extends TransformationConfig = TransformationConfig> = {
  request?: RequestConfig
  transformation?: T
}

export type TypeDefaultsConfig<
  TD extends TransformationDefaultConfig = TransformationDefaultConfig
> = {
  request?: RequestDefaultConfig
  transformation: TD
}

export type AdapterApiConfig<
  T extends TransformationConfig = TransformationConfig,
  TD extends TransformationDefaultConfig = TransformationDefaultConfig,
> = {
  apiVersion?: string
  typeDefaults: TypeDefaultsConfig<TD>
  types: Record<string, TypeConfig<T>>
}

export type UserFetchConfig = {
  includeTypes: string[]
}

export const createAdapterApiConfigType = ({
  adapter,
  additionalFields,
  requestTypes,
  transformationTypes,
}: {
  adapter: string
  additionalFields?: Record<string, FieldDefinition>
  requestTypes: { request: ObjectType; requestDefault: ObjectType }
  transformationTypes: { transformation: ObjectType; transformationDefault: ObjectType }
}): ObjectType => {
  const typeDefaultsConfigType = createMatchingObjectType<TypeDefaultsConfig>({
    elemID: new ElemID(adapter, 'typeDefaultsConfig'),
    fields: {
      request: { refType: requestTypes.requestDefault },
      transformation: {
        refType: transformationTypes.transformationDefault,
        annotations: {
          _required: true,
        },
      },
    },
  })

  const typesConfigType = createMatchingObjectType<TypeConfig>({
    elemID: new ElemID(adapter, 'typesConfig'),
    fields: {
      request: { refType: requestTypes.request },
      transformation: { refType: transformationTypes.transformation },
    },
  })

  const adapterApiConfigType = createMatchingObjectType<AdapterApiConfig>({
    elemID: new ElemID(adapter, 'adapterApiConfig'),
    fields: {
      types: {
        refType: new MapType(typesConfigType),
        annotations: {
          _required: true,
        },
      },
      typeDefaults: {
        refType: typeDefaultsConfigType,
        annotations: {
          _required: true,
        },
      },
      apiVersion: {
        refType: BuiltinTypes.STRING,
      },
      ...additionalFields,
    },
  })
  return adapterApiConfigType
}

export const createUserFetchConfigType = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
): ObjectType => (
  new ObjectType({
    elemID: new ElemID(adapter, 'userFetchConfig'),
    fields: {
      includeTypes: { refType: new ListType(BuiltinTypes.STRING) },
      ...additionalFields,
    },
  })
)

export const getConfigWithDefault = <
  T extends TransformationConfig | RequestConfig | undefined,
  S extends TransformationDefaultConfig | RequestDefaultConfig
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
