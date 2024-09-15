/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios from 'axios'
import {
  InstanceElement,
  OAuthMethod,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import { AvailableMicrosoftSecurityServices, BASIC_OAUTH_REQUIRED_SCOPES, Credentials, SCOPE_MAPPING } from '../auth'

export const getOAuthRequiredScopes = (servicesToManage: AvailableMicrosoftSecurityServices[]): string => {
  const scopes = servicesToManage.flatMap(service => SCOPE_MAPPING[service])
  return [...new Set([...BASIC_OAUTH_REQUIRED_SCOPES, ...scopes])].join(' ')
}

export const getAuthenticationBaseUrl = (tenantId: string): string =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`

const getRedirectUri = (port: number): string => `http://localhost:${port}/extract`

const getServicesToManageFromResponse = (response: Values): AvailableMicrosoftSecurityServices[] =>
  Object.entries(response)
    .filter(([, shouldManage]) => shouldManage)
    .map(([serviceName]) => serviceName as AvailableMicrosoftSecurityServices)

export const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, clientId, clientSecret: _clientSecret, port, ...servicesToManageResponse } = userInput.value
  const baseUrl = getAuthenticationBaseUrl(tenantId)
  const redirectUri = getRedirectUri(port)
  const servicesToManage = getServicesToManageFromResponse(servicesToManageResponse)
  if (servicesToManage.length === 0) {
    throw new Error('At least one service should be selected to be managed by Salto')
  }
  const scope = `offline_access ${getOAuthRequiredScopes(servicesToManage)}`
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
  const { tenantId, clientId, clientSecret, port, ...servicesToManageResponse } = input
  const { code } = response.fields
  const httpClient = axios.create({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  const servicesToManage = getServicesToManageFromResponse(servicesToManageResponse)
  const data = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(port),
    scope: getOAuthRequiredScopes(servicesToManage),
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
    servicesToManage,
  }
}
