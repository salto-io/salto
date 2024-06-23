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
import { ClientOptions, OktaFetchOptions, PaginationOptions } from '../types'
import { OktaUserConfig } from '../../user_config'

export const createClientDefinitions = (
  clients: Record<ClientOptions, definitions.RESTApiClientDefinition<PaginationOptions>['httpClient']>,
): definitions.ApiDefinitions<OktaFetchOptions>['clients'] => ({
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
          Group: {
            get: {
              queryArgs: { limit: '10000' }, // maximum page size allowed
            },
          },
          Application: {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          GroupRule: {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          ApplicationGroupAssignment: {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          ProfileMapping: {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          User: {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
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
