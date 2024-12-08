/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import axios from 'axios'
import { logger } from '@salto-io/logging'
import {
  InstanceElement,
  OAuthMethod,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import {
  AVAILABLE_MICROSOFT_SECURITY_SERVICES,
  AvailableMicrosoftSecurityServices,
  BASIC_OAUTH_REQUIRED_SCOPES,
  Credentials,
  MicrosoftServicesToManage,
  SCOPE_MAPPING,
} from '../auth'

const log = logger(module)

const extractServicesToManageFromInputAsArray = (userInput: Values): AvailableMicrosoftSecurityServices[] =>
  AVAILABLE_MICROSOFT_SECURITY_SERVICES.filter(service => userInput[service] === true)

export const getOAuthRequiredScopes = (userInput: Values): string => {
  const servicesToManage = extractServicesToManageFromInputAsArray(userInput)
  const scopes = servicesToManage.flatMap(service => SCOPE_MAPPING[service])
  log.trace('Using scopes %s for services %s', scopes, servicesToManage)
  return [...new Set([...BASIC_OAUTH_REQUIRED_SCOPES, ...scopes])].join(' ')
}

export const getAuthenticationBaseUrl = (tenantId: string): string =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`

const getRedirectUri = (port: number): string => `http://localhost:${port}/extract`

const extractServicesToManageFromInputAsObject = (userInput: Values): MicrosoftServicesToManage =>
  _.pick(userInput, AVAILABLE_MICROSOFT_SECURITY_SERVICES)

export const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  const { tenantId, clientId, port } = userInput.value
  if (extractServicesToManageFromInputAsArray(userInput.value).length === 0) {
    throw new Error('At least one service should be selected to be managed by Salto')
  }

  const baseUrl = getAuthenticationBaseUrl(tenantId)
  const redirectUri = getRedirectUri(port)
  const scope = `offline_access ${getOAuthRequiredScopes(userInput.value)}`
  const url = `${baseUrl}/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&prompt=select_account`

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
    scope: getOAuthRequiredScopes(input),
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
    servicesToManage: extractServicesToManageFromInputAsObject(input),
  }
}
