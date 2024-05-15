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
import { createAdapter, credentials } from '@salto-io/adapter-components'
import { Credentials, credentialsType } from './auth'
import createChangeValidator from './change_validator'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { Options } from './definitions/types'
import { REFERENCES } from './definitions/references'

const { defaultCredentialsFromConfig } = credentials

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  definitionsCreator: ({ clients, userConfig }) => ({
    clients: createClientDefinitions(clients),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(userConfig.fetch),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
    // TODO add other customizations if needed (check which ones are available - e.g. additional filters)
    additionalChangeValidators: createChangeValidator,
  },
  // add names of clients that should be created (if undefined, the adapter wrapper will create them)
  initialClients: {
    main: undefined,
  },
  // TODO adjust according to service rate limits, or remove to set as unlimited
  // clientDefaults: {
  //   rateLimit: {
  //     total: 100,
  //     get: 100,
  //     deploy: 100,
  //   },
  //   maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  //   retry: DEFAULT_RETRY_OPTS,
  // },
})
