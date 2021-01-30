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

export type EndpointConfig = {
  url: string
  queryParams?: Record<string, string>
  recursiveQueryByResponseField?: Record<string, string>
  dependsOn?: string[]
  paginationField?: string
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

export type ResourceConfig = {
  endpoint: EndpointConfig
}

export type AdapterApiConfig = {
  resources: Record<string, ResourceConfig>
  apiVersion?: string
}

export type UserFetchConfig = {
  includeResources: string[]
}

export const createAdapterApiConfigType = (
  adapter: string,
  additionalEndpointFields?: Record<string, FieldDefinition>,
): ObjectType => {
  const endpointConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'endpointConfig'),
    fields: {
      url: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      queryParams: { type: new MapType(BuiltinTypes.STRING) },
      recursiveQueryByResponseField: { type: new MapType(BuiltinTypes.STRING) },
      dependsOn: { type: new ListType(BuiltinTypes.STRING) },
      paginationField: { type: BuiltinTypes.STRING },
      fieldsToOmit: { type: new ListType(BuiltinTypes.STRING) },
      fieldsToExtract: { type: new ListType(BuiltinTypes.STRING) },
      hasDynamicFields: { type: BuiltinTypes.BOOLEAN },
      nameField: { type: BuiltinTypes.STRING },
      pathField: { type: BuiltinTypes.STRING },
      keepOriginal: { type: BuiltinTypes.BOOLEAN },
      ...additionalEndpointFields,
    },
  })

  const resourceConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'resourceConfig'),
    fields: {
      endpoint: {
        type: endpointConfigType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const adapterApiConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'adapterApiConfig'),
    fields: {
      resources: {
        type: new MapType(resourceConfigType),
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
      includeResources: { type: new ListType(BuiltinTypes.STRING) },
    },
  })
)

export const validateFetchConfig = (
  fetchConfigPath: string,
  userFetchConfig: UserFetchConfig,
  adapterApiConfig: AdapterApiConfig,
): void => {
  const resourceNames = new Set(Object.keys(adapterApiConfig.resources))
  const invalidIncludeResources = userFetchConfig.includeResources.filter(
    name => !resourceNames.has(name)
  )
  if (invalidIncludeResources.length > 0) {
    throw Error(`Invalid resource names in ${fetchConfigPath}: ${invalidIncludeResources}`)
  }
}
