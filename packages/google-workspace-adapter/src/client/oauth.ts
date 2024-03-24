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
  OAuthMethod,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import { Credentials, OAuth2Client } from 'google-auth-library'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../constants'

const REQUIRED_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/admin.directory.rolemanagement',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.domain',
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/admin.directory.userschema',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar',
]

export const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
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

export type OauthRequestParameters = {
  clientId: string
  clientSecret: string
  redirectUri: string
  port: number
}

export type OauthAccessTokenCredentials = Required<
  Pick<Credentials, 'access_token' | 'refresh_token' | 'expiry_date'>
> &
  Omit<OauthRequestParameters, 'port'>

export const oauthAccessTokenCredentialsType = createMatchingObjectType<OauthAccessTokenCredentials>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    access_token: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    refresh_token: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    expiry_date: {
      refType: BuiltinTypes.NUMBER,
      annotations: { _required: true },
    },
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    redirectUri: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

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

export const createFromOauthResponse: OAuthMethod['createFromOauthResponse'] = async (
  input: Values,
  response: OauthAccessTokenResponse,
) => {
  const { clientId, clientSecret, redirectUri } = input
  const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
  const { code } = response.fields
  const { tokens } = await oAuth2Client.getToken(code)
  return {
    ...tokens,
    clientId,
    clientSecret,
  }
}
