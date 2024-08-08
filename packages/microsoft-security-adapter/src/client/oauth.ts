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
import axios from 'axios'
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  OAuthMethod,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../constants'

export const OAUTH_REQUIRED_SCOPES = [
  'AdministrativeUnit.ReadWrite.All',
  'Application.ReadWrite.All',
  'CustomSecAttributeDefinition.ReadWrite.All',
  'Directory.ReadWrite.All',
  'Domain.ReadWrite.All',
  'Group.ReadWrite.All',
  'Policy.Read.All',
  'Policy.ReadWrite.AuthenticationMethod',
  'Policy.ReadWrite.ConditionalAccess',
  'Policy.ReadWrite.CrossTenantAccess',
  'Policy.ReadWrite.PermissionGrant',
  'RoleManagement.ReadWrite.Directory',
  'UserAuthenticationMethod.ReadWrite.All',
]

export type OauthRequestParameters = {
  tenantId: string
  clientId: string
  clientSecret: string
  port: number
}

export const oauthRequestParameters = createMatchingObjectType<OauthRequestParameters>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    tenantId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Tenant ID',
        _required: true,
      },
    },
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
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        message: 'Port',
        _required: true,
      },
    },
  },
})

export type Credentials = Omit<OauthRequestParameters, 'port'> & {
  refreshToken: string
}

export const credentialsType = createMatchingObjectType<Credentials>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    tenantId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Tenant ID' },
    },
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Client ID' },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Client Secret' },
    },
    refreshToken: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Refresh Token' },
    },
  },
})

export const getAuthenticationBaseUrl = (tenantId: string): string =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`

const getRedirectUri = (port: number): string => `http://localhost:${port}/extract`

export const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  const { tenantId, clientId, port } = userInput.value
  const baseUrl = getAuthenticationBaseUrl(tenantId)
  const redirectUri = getRedirectUri(port)
  const scope = ['offline_access', ...OAUTH_REQUIRED_SCOPES].join(' ')
  const url = `${baseUrl}/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`

  return {
    url,
    oauthRequiredFields: ['code'],
  }
}

export const createFromOauthResponse: OAuthMethod['createFromOauthResponse'] = async (
  input: Values,
  response: OauthAccessTokenResponse,
): Promise<Credentials> => {
  const { tenantId, clientId, clientSecret, port } = input
  const { code } = response.fields
  const httpClient = axios.create({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  const data = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(port),
    scope: OAUTH_REQUIRED_SCOPES.join(' '),
    grant_type: 'authorization_code',
    code,
  })
  const res = await httpClient.post(`${getAuthenticationBaseUrl(tenantId)}/token`, data)
  const { refresh_token: refreshToken } = res.data
  return {
    tenantId,
    clientId,
    clientSecret,
    refreshToken,
  }
}
