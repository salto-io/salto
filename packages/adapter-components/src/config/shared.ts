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
  ElemID, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, FieldDefinition, ListType, MapType,
} from '@salto-io/adapter-api'
import { RequestConfig, RequestDefaultConfig } from './request'
import { TransformationConfig, TransformationDefaultConfig } from './transformation'

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
  fieldsAnnotations?: string[]
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
  const typeDefaultsConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'typeDefaultsConfig'),
    fields: {
      request: { type: new MapType(requestTypes.requestDefault) },
      transformation: {
        type: new MapType(transformationTypes.transformationDefault),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const typesConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'typesConfig'),
    fields: {
      request: { type: requestTypes.request },
      transformation: { type: transformationTypes.transformation },
    },
  })

  const adapterApiConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'adapterApiConfig'),
    fields: {
      types: {
        type: new MapType(typesConfigType),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      typeDefaults: {
        type: typeDefaultsConfigType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      apiVersion: {
        type: BuiltinTypes.STRING,
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
      includeTypes: { type: new ListType(BuiltinTypes.STRING) },
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
