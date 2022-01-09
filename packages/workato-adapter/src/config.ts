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
import { ElemID, ObjectType, CORE_ANNOTATIONS, BuiltinTypes, ListType, MapType } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { WORKATO, PROPERTY_TYPE, ROLE_TYPE, API_COLLECTION_TYPE, FOLDER_TYPE, RECIPE_TYPE, CONNECTION_TYPE, API_ENDPOINT_TYPE, API_CLIENT_TYPE, API_ACCESS_PROFILE_TYPE } from './constants'

const { createClientConfigType } = clientUtils
const {
  createUserFetchConfigType, createDucktypeAdapterApiConfigType, validateDuckTypeFetchConfig,
} = configUtils

export const DEFAULT_ID_FIELDS = ['name']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created_at', fieldType: 'string' },
  { fieldName: 'updated_at', fieldType: 'string' },
  { fieldName: 'extended_input_schema' },
  { fieldName: 'extended_output_schema' },
]

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type WorkatoClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type WorkatoFetchConfig = configUtils.UserFetchConfig & {
  serviceConnectionNames?: Record<string, string[]>
}
export type WorkatoApiConfig = configUtils.AdapterDuckTypeApiConfig

export type WorkatoConfig = {
  [CLIENT_CONFIG]?: WorkatoClientConfig
  [FETCH_CONFIG]: WorkatoFetchConfig
  [API_DEFINITIONS_CONFIG]: WorkatoApiConfig
}

export const DEFAULT_TYPES: Record<string, configUtils.TypeDuckTypeConfig> = {
  [CONNECTION_TYPE]: {
    request: {
      url: '/connections',
    },
  },
  [RECIPE_TYPE]: {
    request: {
      url: '/recipes',
      paginationField: 'since_id',
    },
    transformation: {
      idFields: ['name', 'id'], // not multienv-friendly - see SALTO-1241
      fieldsToOmit: [
        ...FIELDS_TO_OMIT,
        { fieldName: 'last_run_at' },
        { fieldName: 'job_succeeded_count' },
        { fieldName: 'job_failed_count' },
      ],
      standaloneFields: [
        { fieldName: 'code', parseJSON: true },
      ],
    },
  },
  [FOLDER_TYPE]: {
    request: {
      url: '/folders',
      recursiveQueryByResponseField: {
        // eslint-disable-next-line camelcase
        parent_id: 'id',
      },
      paginationField: 'page',
    },
    transformation: {
      idFields: ['name', 'parent_id'], // not multienv-friendly - see SALTO-1241
    },
  },
  // eslint-disable-next-line camelcase
  [API_COLLECTION_TYPE]: {
    request: {
      url: '/api_collections',
      paginationField: 'page',
    },
  },
  // eslint-disable-next-line camelcase
  [API_ENDPOINT_TYPE]: {
    request: {
      url: '/api_endpoints',
      paginationField: 'page',
    },
    transformation: {
      idFields: ['name', 'base_path'],
    },
  },
  // eslint-disable-next-line camelcase
  [API_CLIENT_TYPE]: {
    request: {
      url: '/api_clients',
      paginationField: 'page',
    },
  },
  // eslint-disable-next-line camelcase
  [API_ACCESS_PROFILE_TYPE]: {
    request: {
      url: '/api_access_profiles',
      paginationField: 'page',
    },
  },
  [ROLE_TYPE]: {
    request: {
      url: '/roles',
    },
  },
  [PROPERTY_TYPE]: {
    request: {
      url: '/properties',
      queryParams: {
        prefix: '',
      },
    },
    transformation: {
      hasDynamicFields: true,
    },
  },
}

export const DEFAULT_CONFIG: WorkatoConfig = {
  [FETCH_CONFIG]: {
    includeTypes: [
      ...Object.keys(_.pickBy(DEFAULT_TYPES, def => def.request !== undefined)),
    ].sort(),
  },
  [API_DEFINITIONS_CONFIG]: {
    typeDefaults: {
      transformation: {
        idFields: DEFAULT_ID_FIELDS,
        fieldsToOmit: FIELDS_TO_OMIT,
      },
    },
    types: DEFAULT_TYPES,
  },
}

export const configType = new ObjectType({
  elemID: new ElemID(WORKATO),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(WORKATO),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(
        WORKATO,
        {
          serviceConnectionNames: {
            refType: new MapType(new ListType(BuiltinTypes.STRING)),
          },
        },
      ),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({ adapter: WORKATO }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(DEFAULT_CONFIG, API_DEFINITIONS_CONFIG),
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: WorkatoFetchConfig
  [API_DEFINITIONS_CONFIG]: WorkatoApiConfig
}


export const validateFetchConfig = (
  fetchConfigPath: string,
  userFetchConfig: WorkatoFetchConfig,
  adapterApiConfig: configUtils.AdapterApiConfig,
): void => {
  validateDuckTypeFetchConfig(fetchConfigPath, userFetchConfig, adapterApiConfig)
}
