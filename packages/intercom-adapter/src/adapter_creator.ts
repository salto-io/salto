/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createAdapter, credentials } from '@salto-io/adapter-components'
import { Credentials, credentialsType } from './auth'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { REFERENCES } from './definitions/references'
import { Options } from './definitions/types'
import { createFromOauthResponse, createOAuthRequest, oauthRequestParameters } from './client/oauth'
import { createConnection } from './client/connection'

const { defaultCredentialsFromConfig } = credentials

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
    oauth: {
      oauthRequestParameters,
      credentialsType,
      createOAuthRequest,
      createFromOauthResponse,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  definitionsCreator: ({ clients, userConfig }) => ({
    clients: createClientDefinitions(clients),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(userConfig.fetch),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
  },
  initialClients: {
    main: undefined,
  },
})
