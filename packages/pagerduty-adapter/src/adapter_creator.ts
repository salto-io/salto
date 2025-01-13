/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  client as clientUtils,
  createAdapter,
  credentials as defaultCredentials,
  filters,
} from '@salto-io/adapter-components'
import { BuiltinTypes } from '@salto-io/adapter-api'
import { Credentials, credentialsType } from './auth'
import createChangeValidator from './change_validator'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { Options } from './definitions/types'
import { REFERENCES } from './definitions/references'
import convertUsersIds from './filters/users'

const { defaultCredentialsFromConfig } = defaultCredentials

const { DEFAULT_RETRY_OPTS } = clientUtils

const clientDefaults = {
  rateLimit: {
    total: 100,
    get: 100,
    deploy: 100,
  },
  maxRequestsPerMinute: 960,
  retry: DEFAULT_RETRY_OPTS,
}

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  additionalConfigFields: {
    fetch: {
      convertUsersIds: { refType: BuiltinTypes.BOOLEAN },
    },
  },
  definitionsCreator: ({ clients, credentials }) => ({
    clients: createClientDefinitions(clients),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(credentials),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
    additionalChangeValidators: createChangeValidator,
    customizeFilterCreators: args => ({
      ...filters.createCommonFilters<Options, UserConfig>(args),
      convertUsersIds,
    }),
  },
  initialClients: {
    main: undefined,
  },
  clientDefaults,
})
