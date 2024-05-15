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
import { createAdapter, credentials, client, filters } from '@salto-io/adapter-components'
import { Credentials, credentialsType } from './auth'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { Options } from './definitions/types'
import { REFERENCES } from './definitions/references'
import { customConvertError } from './error_utils'
import transformTemplateBodyToTemplateExpressionFilterCreator from './filters/transform_template_body_to_template_expression'
import customPathsFilterCreator from './filters/custom_paths'
import deploySpaceAndPermissionsFilterCreator from './filters/deploy_space_and_permissions'
import createChangeValidator from './change_validator'

const { DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } = client
const { defaultCredentialsFromConfig } = credentials

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
    pagination: PAGINATION,
    fetch: createFetchDefinitions(),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
    customizeFilterCreators: args => ({
      // deploySpaceAndPermissionsFilterCreator should run before default deploy filter
      deploySpaceAndPermissionsFilterCreator: deploySpaceAndPermissionsFilterCreator(args),
      ...filters.createCommonFilters<Options, UserConfig>(args),
      // transform template body must run after references are created (fieldReferencesFilter)
      transformTemplateBodyToTemplateExpressionFilterCreator,
      // customPathsFilterCreator must run after fieldReferencesFilter
      customPathsFilterCreator,
    }),
    additionalChangeValidators: createChangeValidator,
  },

  initialClients: {
    main: undefined,
  },

  clientDefaults: {
    rateLimit: {
      total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      get: 60,
      deploy: 2,
    },
    maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    retry: DEFAULT_RETRY_OPTS,
  },
  customConvertError,
})
