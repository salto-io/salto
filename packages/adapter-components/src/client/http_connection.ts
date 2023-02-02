/*
*                      Copyright 2023 Salto Labs Ltd.
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
import axios, { AxiosError, AxiosBasicCredentials, AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'
import { AccountId, CredentialError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ClientRetryConfig } from './config'
import { DEFAULT_RETRY_OPTS } from './constants'

const log = logger(module)

export class UnauthorizedError extends CredentialError {}

export type ResponseValue = {
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Response<T> = {
  data: T
  status: number
  statusText?: string
  headers?: Record<string, string>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type APIConnection<T = any, S = any> = {
  // based on https://github.com/axios/axios/blob/f472e5da5fe76c72db703d6a0f5190e4ad31e642/index.d.ts#L140
  get: (url: string, config?: AxiosRequestConfig) => Promise<Response<T>>
  post: (url: string, data: S, config?: AxiosRequestConfig)
    => Promise<Response<T>>
  put: (url: string, data: S, config?: AxiosRequestConfig) => Promise<Response<T>>
  delete: (url: string, config?: AxiosRequestConfig) => Promise<Response<T>>
  patch: (url: string, data: S, config?: AxiosRequestConfig)
    => Promise<Response<T>>
}

export type AuthenticatedAPIConnection = APIConnection & {
  accountId: AccountId
}

export type RetryOptions = {
  retries: number
  retryDelay?: (retryCount: number, error: AxiosError) => number
  retryCondition?: (error: AxiosError) => boolean
}

type LoginFunc<TCredentials> = (creds: TCredentials) => Promise<AuthenticatedAPIConnection>

export interface Connection<TCredentials> {
  login: LoginFunc<TCredentials>
}

export type ConnectionCreator<TCredentials> = (
  retryOptions: RetryOptions,
) => Connection<TCredentials>

const getRetryDelayFromHeaders = (headers: Record<string, string>): number | undefined => {
  // Although the standard is 'Retry-After' is seems that some servers
  // returns 'retry-after' so just in case we lowercase the headers
  const lowercaseHeaders = _.mapKeys(
    headers,
    (_val, key) => key.toLowerCase()
  )

  const retryAfterHeaderValue = lowercaseHeaders['retry-after']
  if (retryAfterHeaderValue !== undefined) {
    const retryAfter = parseInt(retryAfterHeaderValue, 10) * 1000
    if (Number.isNaN(retryAfter)) {
      log.warn(`Received invalid retry-after header value: ${retryAfterHeaderValue}`)
      return undefined
    }
    return retryAfter
  }
  // Handle rate limits as seen in Okta,
  // x-rate-limit-reset contains the time at which the rate limit resets
  // more information: https://developer.okta.com/docs/reference/rl-best-practices/
  const rateLimitResetHeaderValue = lowercaseHeaders['x-rate-limit-reset']
  if (
    rateLimitResetHeaderValue !== undefined
    && lowercaseHeaders.date !== undefined
  ) {
    const resetTime = parseInt(rateLimitResetHeaderValue, 10) * 1000
    const currentTime = new Date(lowercaseHeaders.date).getTime()
    if (Number.isNaN(resetTime) || Number.isNaN(currentTime)) {
      log.warn(`Received invalid x-rate-limit-reset values: ${rateLimitResetHeaderValue}, ${lowercaseHeaders.date}`)
      return undefined
    }
    return resetTime - currentTime
  }
  return undefined
}

const getRetryDelay = (retryOptions: Required<ClientRetryConfig>, error: AxiosError): number => {
  const retryDelay = getRetryDelayFromHeaders(error.response?.headers ?? {})
  ?? retryOptions.retryDelay

  return retryDelay
}

const shouldRetryStatusCode = (statusCode?: number, additionalStatusesToRetry: number[] = []): boolean =>
  statusCode !== undefined && [429, ...additionalStatusesToRetry].includes(statusCode)

export const createRetryOptions = (retryOptions: Required<ClientRetryConfig>): RetryOptions => ({
  retries: retryOptions.maxAttempts,
  retryDelay: (retryCount, err) => {
    const retryDelay = getRetryDelay(retryOptions, err)

    log.warn('Failed to run client call to %s for reason: %s (%s). Retrying in %ds (attempt %d).',
      err.config.url,
      err.code,
      err.message,
      retryDelay / 1000,
      retryCount)
    return retryDelay
  },
  retryCondition: err => axiosRetry.isNetworkOrIdempotentRequestError(err)
    || shouldRetryStatusCode(err.response?.status, retryOptions.additionalStatusCodesToRetry),
})

type ConnectionParams<TCredentials> = {
  connection?: Connection<TCredentials>
  retryOptions?: RetryOptions
  createConnection: ConnectionCreator<TCredentials>
}

export const createClientConnection = <TCredentials>({
  connection,
  retryOptions,
  createConnection,
}: ConnectionParams<TCredentials>): Connection<TCredentials> => (
    connection ?? createConnection(
      _.defaults({}, retryOptions, createRetryOptions(DEFAULT_RETRY_OPTS))
    )
  )

export const validateCredentials = async <TCredentials>(
  creds: TCredentials,
  createConnectionArgs: ConnectionParams<TCredentials>,
): Promise<AccountId> => {
  const conn = createClientConnection(createConnectionArgs)
  const { accountId } = await conn.login(creds)
  return accountId
}

export type AuthParams = {
  auth?: AxiosBasicCredentials
  headers?: Record<string, unknown>
}

type AxiosConnectionParams<TCredentials> = {
  retryOptions: RetryOptions
  authParamsFunc: (creds: TCredentials) => Promise<AuthParams>
  baseURLFunc: (creds: TCredentials) => string
  credValidateFunc: ({ credentials, connection }: {
    credentials: TCredentials
    connection: APIConnection
  }) => Promise<AccountId>
}

export const axiosConnection = <TCredentials>({
  retryOptions,
  authParamsFunc,
  baseURLFunc,
  credValidateFunc,
}: AxiosConnectionParams<TCredentials>): Connection<TCredentials> => {
  const login = async (
    creds: TCredentials,
  ): Promise<AuthenticatedAPIConnection> => {
    const httpClient = axios.create({
      baseURL: baseURLFunc(creds),
      ...await authParamsFunc(creds),
    })
    axiosRetry(httpClient, retryOptions)

    try {
      const accountId = await credValidateFunc({ credentials: creds, connection: httpClient })
      return {
        ...httpClient,
        accountId,
      }
    } catch (e) {
      log.error(`Login failed: ${e}, stack: ${e.stack}`)
      if (e.response?.status === 401 || e instanceof UnauthorizedError) {
        throw new UnauthorizedError('Unauthorized - update credentials and try again')
      }
      throw new Error(`Login failed with error: ${e}`)
    }
  }

  return {
    login,
  }
}
