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
import { definitions } from '@salto-io/adapter-components'
import { OktaOptions } from '../types'
import { OktaUserConfig } from '../../user_config'

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<OktaOptions>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<OktaOptions>>['httpClient']
  >,
): definitions.ApiDefinitions<OktaOptions>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'cursorHeader',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {
          '/api/v1/groups': {
            get: {
              queryArgs: { limit: '10000' }, // maximum page size allowed
            },
          },
          '/api/v1/apps': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/groups/rules': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/apps/{appId}/groups': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/mappings': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/users': {
            get: {
              queryArgs: {
                limit: '200', // maximum page size allowed
                search: 'id pr', // The search query is needed to fetch deprovisioned users
              },
            },
          },
          '/api/v1/apps/{id}/lifecycle/activate': {
            post: {
              omitBody: true,
            },
          },
          '/api/v1/apps/{id}/lifecycle/deactivate': {
            post: {
              omitBody: true,
            },
          },
          '/api/v1/apps/{source}/policies/{target}': {
            put: {
              omitBody: true,
            },
          },
          '/api/v1/apps/{appId}/groups/{id}': {
            delete: {
              additionalValidStatuses: [404],
            },
          },
        },
      },
    },
    private: {
      httpClient: clients.private,
      endpoints: {
        default: {
          get: {
            pagination: 'cursor',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {},
      },
    },
  },
})

export const shouldAccessPrivateAPIs = (isOAuthLogin: boolean, config: OktaUserConfig): boolean => {
  const usePrivateAPI = config.client?.usePrivateAPI
  if (isOAuthLogin || !usePrivateAPI) {
    return false
  }
  return true
}
