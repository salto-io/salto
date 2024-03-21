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
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import { client as clientUtils, createAdapter, credentials } from '@salto-io/adapter-components'
import { OAuth2Client } from 'google-auth-library'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { Credentials, credentialsType } from './auth'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { REFERENCES } from './definitions/references'
import { Options } from './definitions/types'

const { validateCredentials } = clientUtils

const { defaultCredentialsFromConfig } = credentials

const REQUIRED_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/admin.directory.rolemanagement',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.domain',
]

// TODO adjust if needed. if the config is the same as the credentials, just use it
const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => config.value as Credentials

const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  // create an oAuth client to authorize the API call.  Secrets are kept in a `keys.json` file,
  // which should be downloaded from the Google Developers Console.
  const { clientId, clientSecret, redirectUri } = userInput.value
  const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)

  // Generate the url that will be used for the consent dialog.
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: REQUIRED_OAUTH_SCOPES,
  })

  return {
    url,
    oauthRequiredFields: ['code'],
  }
}

export type OauthAccessTokenCredentials = {
  accessToken: string
}

export const oauthAccessTokenCredentialsType = createMatchingObjectType<OauthAccessTokenCredentials>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    accessToken: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

export type OauthRequestParameters = {
  clientId: string
  clientSecret: string
  redirectUri: string
  port: number
}

export const oauthRequestParametersType = createMatchingObjectType<OauthRequestParameters>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client ID',
        _required: true,
      },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client Secret',
        _required: true,
      },
    },
    redirectUri: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Redirect URI',
        _required: true,
      },
    },
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        message: 'Port',
        _required: true,
      },
    },
  },
})

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType: oauthAccessTokenCredentialsType,
      oauthRequestParameters: oauthRequestParametersType,
      createFromOauthResponse: async (input: Values, response: OauthAccessTokenResponse) => {
        const { clientId, clientSecret, redirectUri } = input
        const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
        const { code } = response.fields
        const accessToken = (await oAuth2Client.getToken(code)).tokens.access_token
        return {
          accessToken,
        }
      },
    },
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    }),
  defaultConfig: DEFAULT_CONFIG,
  // TODON should leave placeholder for client that will be filled by the wrapper
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
  },
  initialClients: {
    main: undefined,
  },
})
