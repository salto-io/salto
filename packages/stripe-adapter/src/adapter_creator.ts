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
import { createAdapter, credentials, client } from '@salto-io/adapter-components'
import { Credentials, credentialsType } from './auth'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createFetchDefinitions, pagination, Options, references } from './definitions'

const { defaultCredentialsFromConfig } = credentials
const { DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } = client

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  definitionsCreator: ({ clients }) => ({
    clients: createClientDefinitions(clients),
    pagination,
    fetch: createFetchDefinitions(),
    references,
    sources: {
      openAPI: [
        {
          url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml',
          toClient: 'main',
        },
      ],
    },
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
  },
  initialClients: {
    main: undefined,
  },
  clientDefaults: {
    rateLimit: {
      total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      get: 25,
      deploy: 25,
    },
    maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    retry: DEFAULT_RETRY_OPTS,
  },
})
