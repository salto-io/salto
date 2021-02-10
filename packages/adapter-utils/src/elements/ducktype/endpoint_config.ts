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
import {
  ElemID, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, ListType, MapType, FieldDefinition,
} from '@salto-io/adapter-api'

export type RequestConfig = {
  url: string
  queryParams?: Record<string, string>
  recursiveQueryByResponseField?: Record<string, string>
  // not finalized - do not use yet
  dependsOn?: string[]
  paginationField?: string
}

export type ElementTranslationConfig = {
  fieldsToOmit?: string[]
  // fields to convert into their own type and instances.
  // if the field value is a string, first parse it into json
  fieldsToExtract?: string[]
  // endpoints whose response is a single object with dynamic keys
  hasDynamicFields?: boolean
  nameField?: string
  pathField?: string
  // when true, avoid trying to extract nested fields from response
  keepOriginal?: boolean
}

export type EndpointConfig = {
  request: RequestConfig
  translation?: ElementTranslationConfig
}

export type AdapterApiConfig = {
  endpoints: Record<string, EndpointConfig>
  apiVersion?: string
}

export type UserFetchConfig = {
  includeEndpoints: string[]
}

export const createAdapterApiConfigType = (
  adapter: string,
  additionalEndpointFields?: Record<string, FieldDefinition>,
  additionalTranslationFields?: Record<string, FieldDefinition>,
): ObjectType => {
  const requestConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'requestConfig'),
    fields: {
      url: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      queryParams: { type: new MapType(BuiltinTypes.STRING) },
      recursiveQueryByResponseField: { type: new MapType(BuiltinTypes.STRING) },
      // not finalized - not exposing in config yet
      // dependsOn: { type: new ListType(BuiltinTypes.STRING) },
      paginationField: { type: BuiltinTypes.STRING },
      ...additionalEndpointFields,
    },
  })

  const elementTranslationConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'elementTranslationConfig'),
    fields: {
      fieldsToOmit: { type: new ListType(BuiltinTypes.STRING) },
      fieldsToExtract: { type: new ListType(BuiltinTypes.STRING) },
      hasDynamicFields: { type: BuiltinTypes.BOOLEAN },
      nameField: { type: BuiltinTypes.STRING },
      pathField: { type: BuiltinTypes.STRING },
      keepOriginal: { type: BuiltinTypes.BOOLEAN },
      ...additionalTranslationFields,
    },
  })

  const endpointConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'endpointConfig'),
    fields: {
      endpoint: {
        type: requestConfigType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      translation: {
        type: elementTranslationConfigType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const adapterApiConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'adapterApiConfig'),
    fields: {
      endpoints: {
        type: new MapType(endpointConfigType),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      apiVersion: {
        type: BuiltinTypes.STRING,
      },
    },
  })
  return adapterApiConfigType
}

export const createUserFetchConfigType = (
  adapter: string,
): ObjectType => (
  new ObjectType({
    elemID: new ElemID(adapter, 'userFetchConfig'),
    fields: {
      includeEndpoints: { type: new ListType(BuiltinTypes.STRING) },
    },
  })
)

export const validateFetchConfig = (
  fetchConfigPath: string,
  userFetchConfig: UserFetchConfig,
  adapterApiConfig: AdapterApiConfig,
): void => {
  const endpointNames = new Set(Object.keys(adapterApiConfig.endpoints))
  const invalidIncludeEndpoints = userFetchConfig.includeEndpoints.filter(
    name => !endpointNames.has(name)
  )
  if (invalidIncludeEndpoints.length > 0) {
    throw Error(`Invalid endpoint names in ${fetchConfigPath}: ${invalidIncludeEndpoints}`)
  }
}
