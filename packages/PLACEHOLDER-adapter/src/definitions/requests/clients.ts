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
import { ClientOptions, PaginationOptions } from '../types'

// TODO adjust, remove unnecessary customizations

export const createClientDefinitions = (
  clients: Record<ClientOptions, definitions.RESTApiClientDefinition<PaginationOptions>['httpClient']>,
): definitions.ApiDefinitions<{ clientOptions: ClientOptions; paginationOptions: PaginationOptions }>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
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
        customizations: {
          // '/api/v2/groups': {
          //   get: {
          //     pagination: 'offset',
          //     queryArgs: { type: 'a' },
          //   },
          // },
        },
      },
    },
  },
})
