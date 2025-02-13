/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createAdapter, credentials as credentialsUtils, filters } from '@salto-io/adapter-components'
import createChangeValidator from './change_validator'
import { createConnection } from './client/connection'
import { MICROSOFT_SECURITY } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { Options } from './definitions/types'
import { REFERENCES } from './definitions/references/references'
import { createFromOauthResponse, createOAuthRequest } from './client/oauth'
import {
  entraApplicationStandaloneFieldsFilter,
  deployAdministrativeUnitMembersFilter,
  deployDirectoryRoleMembersFilter,
} from './filters'
import { customConvertError } from './error_utils'
import { Credentials, credentialsType, oauthRequestParameters } from './auth'
import { createFixElementFunctions } from './fix_elements'
import { additionalDeployConfigFieldsType, DEFAULT_CONFIG, UserConfig } from './config'

const { defaultCredentialsFromConfig } = credentialsUtils

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: MICROSOFT_SECURITY,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType,
      oauthRequestParameters,
      createFromOauthResponse,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  definitionsCreator: ({ clients, credentials }) => ({
    clients: createClientDefinitions(clients),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(credentials.servicesToManage),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
    additionalChangeValidators: () => createChangeValidator(),
    customizeFilterCreators: args => ({
      deployAdministrativeUnitMembersFilter,
      deployDirectoryRoleMembersFilter,
      entraApplicationStandaloneFieldsFilter,
      ...filters.createCommonFilters<Options, UserConfig>(args),
    }),
    customizeFixElements: createFixElementFunctions,
  },
  customConvertError,
  initialClients: {
    main: undefined,
  },
  additionalConfigFields: { deploy: additionalDeployConfigFieldsType },
})
