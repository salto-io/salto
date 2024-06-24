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
import _ from 'lodash'
import qs from 'qs'
import axios, { AxiosRequestHeaders } from 'axios'
import axiosRetry from 'axios-retry'
import { logger } from '@salto-io/logging'
import { RetryOptions } from '../client/http_connection'

const log = logger(module)

export type OAuthClientCredentialsArgs = {
  clientId: string
  clientSecret: string
}

const BEARER_TOKEN_TYPE = 'bearer'

/**
 * Authenticate using OAuth 2.0 with the client_credentials grant type.
 *
 * Can be extended to include a scope in the request when needed.
 * Not yet handling refreshing on expiration (when added, it should be done in the connection).
 */
export const oauthClientCredentialsBearerToken = async ({
  endpoint = '/oauth/token',
  baseURL,
  clientId,
  clientSecret,
  retryOptions,
  additionalHeaders = {},
  additionalData = {},
}: OAuthClientCredentialsArgs & {
  endpoint?: string
  baseURL: string
  retryOptions: RetryOptions
  additionalHeaders?: Record<string, string>
  additionalData?: Record<string, string>
}): Promise<{ headers?: AxiosRequestHeaders }> => {
  const httpClient = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...additionalHeaders,
    },
  })
  axiosRetry(httpClient, retryOptions)

  const res = await httpClient.post(
    endpoint,
    qs.stringify({
      // eslint-disable-next-line camelcase
      client_id: clientId,
      // eslint-disable-next-line camelcase
      client_secret: clientSecret,
      // eslint-disable-next-line camelcase
      grant_type: 'client_credentials',
      ...additionalData,
    }),
  )
  const { token_type: tokenType, access_token: accessToken, expires_in: expiresIn } = res.data
  log.debug('received access token: type %s, expires in %s', tokenType, expiresIn)
  if (tokenType !== BEARER_TOKEN_TYPE) {
    throw new Error(`Unsupported token type ${tokenType}`)
  }
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
}

/**
 * Refresh OAuth 2.0 accessToken using authorization code grant type.
 */
export const oauthAccessTokenRefresh = async ({
  endpoint,
  baseURL,
  clientId,
  clientSecret,
  refreshToken,
  retryOptions,
}: {
  endpoint: string
  baseURL: string
  clientId: string
  clientSecret: string
  refreshToken: string
  retryOptions: RetryOptions
}): Promise<{ headers?: AxiosRequestHeaders }> => {
  const httpClient = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'binary').toString('base64')}`,
    },
  })
  axiosRetry(httpClient, retryOptions)

  const res = await httpClient.post(
    endpoint,
    qs.stringify({
      // eslint-disable-next-line camelcase
      refresh_token: refreshToken,
      // eslint-disable-next-line camelcase
      grant_type: 'refresh_token',
    }),
  )
  const { token_type: tokenType, access_token: accessToken, expires_in: expiresIn } = res.data
  log.debug('refreshed access token: type %s, expires in %s', tokenType, expiresIn)
  if (_.lowerCase(tokenType) !== BEARER_TOKEN_TYPE) {
    throw new Error(`Unsupported token type ${tokenType}`)
  }
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
}
