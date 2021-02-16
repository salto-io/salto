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
import { ElemID, ObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-utils'
import { WORKATO } from './constants'

const { createClientConfigType } = clientUtils
const { createUserFetchConfigType, createAdapterApiConfigType } = elementUtils.ducktype

export const DEFAULT_NAME_FIELD = 'name'
export const DEFAULT_PATH_FIELD = 'name'
export const FIELDS_TO_OMIT = ['created_at', 'updated_at']

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type WorkatoClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type WorkatoFetchConfig = elementUtils.ducktype.UserFetchConfig
export type WorkatoApiConfig = elementUtils.ducktype.AdapterApiConfig

export type WorkatoConfig = {
  [CLIENT_CONFIG]?: WorkatoClientConfig
  [FETCH_CONFIG]: WorkatoFetchConfig
  [API_DEFINITIONS_CONFIG]?: WorkatoApiConfig
}

export type ConfigChangeSuggestion = {
  type: keyof WorkatoConfig
  value: string
  reason?: string
}

export type FetchElements<T> = {
  configChanges: ConfigChangeSuggestion[]
  elements: T
}

export const DEFAULT_ENDPOINTS: Record<string, elementUtils.ducktype.EndpointConfig> = {
  connection: {
    request: {
      url: '/connections',
    },
  },
  recipe: {
    request: {
      url: '/recipes',
    },
    translation: {
      fieldsToOmit: ['last_run_at', 'job_succeeded_count', 'job_failed_count', 'created_at', 'updated_at'],
      fieldsToExtract: ['code'],
    },
  },
  folder: {
    request: {
      url: '/folders',
      recursiveQueryByResponseField: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        parent_id: 'id',
      },
      paginationField: 'page',
    },
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  api_collection: {
    request: {
      url: '/api_collections',
    },
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  api_endpoint: {
    request: {
      url: '/api_endpoints',
    },
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  api_client: {
    request: {
      url: '/api_clients',
    },
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  api_access_profile: {
    request: {
      url: '/api_access_profiles',
    },
  },
  role: {
    request: {
      url: '/roles',
    },
  },
  property: {
    request: {
      url: '/properties',
      queryParams: {
        prefix: '',
      },
    },
    translation: {
      hasDynamicFields: true,
    },
  },
}

export const configType = new ObjectType({
  elemID: new ElemID(WORKATO),
  fields: {
    [CLIENT_CONFIG]: {
      type: createClientConfigType(WORKATO),
    },
    [FETCH_CONFIG]: {
      type: createUserFetchConfigType(WORKATO),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.DEFAULT]: {
          includeEndpoints: [...Object.keys(DEFAULT_ENDPOINTS)].sort(),
        },
      },
    },
    [API_DEFINITIONS_CONFIG]: {
      type: createAdapterApiConfigType(WORKATO),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {
          endpoints: DEFAULT_ENDPOINTS,
        },
      },
    },
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: WorkatoFetchConfig
  [API_DEFINITIONS_CONFIG]: WorkatoApiConfig
}
