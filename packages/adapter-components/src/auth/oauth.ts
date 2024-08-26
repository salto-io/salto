/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
}): Promise<{ headers?: Partial<AxiosRequestHeaders> }> => {
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
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      ...additionalData,
    }),
  )
  const { token_type: tokenType, access_token: accessToken, expires_in: expiresIn } = res.data
  log.debug('received access token: type %s, expires in %s', tokenType, expiresIn)
  if (String(tokenType).toLowerCase() !== BEARER_TOKEN_TYPE.toLowerCase()) {
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
}): Promise<{ headers?: Partial<AxiosRequestHeaders> }> => {
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
      refresh_token: refreshToken,
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
