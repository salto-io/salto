/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, createAdapter, credentials, filters } from '@salto-io/adapter-components'
import { Credentials, basicCredentialsType } from './auth'
import createChangeValidator from './change_validator'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnectionForApp } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { REFERENCES } from './definitions/references'
import { Options } from './definitions/types'
import {
  CLOUD_IDENTITY_APP_NAME,
  DIRECTORY_APP_NAME,
  GROUP_SETTINGS_APP_NAME,
  createFromOauthResponse,
  createOAuthRequest,
  oauthAccessTokenCredentialsType,
  oauthRequestParametersType,
} from './client/oauth'
import customPathsFilterCreator from './filters/custom_paths'
import { createFixElementFunctions } from './fix_elements'

const { validateCredentials } = clientUtils

const { defaultCredentialsFromConfig } = credentials

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => config.value as Credentials

const clientDefaults = {
  rateLimit: {
    total: 100,
    get: 100,
    deploy: 100,
  },
}

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType: basicCredentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType: oauthAccessTokenCredentialsType,
      oauthRequestParameters: oauthRequestParametersType,
      createFromOauthResponse,
    },
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection: createConnectionForApp(DIRECTORY_APP_NAME),
    }),
  defaultConfig: DEFAULT_CONFIG,
  additionalConfigFields: {
    deploy: {
      defaultDomain: { refType: BuiltinTypes.STRING },
    },
  },
  definitionsCreator: ({ clients }) => ({
    clients: createClientDefinitions(clients),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnectionForApp(DIRECTORY_APP_NAME),
    credentialsFromConfig: defaultCredentialsFromConfig,
    customizeFilterCreators: args => ({
      ...filters.createCommonFilters<Options, UserConfig>(args),
      // customPathsFilterCreator must run after fieldReferencesFilter
      customPathsFilterCreator,
    }),
    additionalChangeValidators: createChangeValidator,
    customizeFixElements: createFixElementFunctions,
  },
  initialClients: {
    main: undefined,
    groupSettings: createConnectionForApp(GROUP_SETTINGS_APP_NAME),
    cloudIdentity: createConnectionForApp(CLOUD_IDENTITY_APP_NAME),
  },
  clientDefaults,
})
