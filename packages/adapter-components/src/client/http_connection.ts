/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AccountId } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ClientRetryConfig } from './config'
import { DEFAULT_RETRY_OPTS } from './constants'

const log = logger(module)

export class UnauthorizedError extends Error {}

export type ResponseValue = {
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Response<T> = {
  data: T
  status: number
  statusText?: string
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

type AuthenticatedAPIConnection = APIConnection & {
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

const getRetryDelay = (retryOptions: Required<ClientRetryConfig>, error: AxiosError): number => {
  // Although the standard is 'Retry-After' is seems that some servers
  // returns 'retry-after' so just in case we lowercase the headers
  const retryAfterHeaderValue = _.mapKeys(
    error.response?.headers ?? {},
    (_val, key) => key.toLowerCase()
  )['retry-after']

  const retryDelay = retryAfterHeaderValue !== undefined
    ? parseInt(retryAfterHeaderValue, 10) * 1000
    : retryOptions.retryDelay

  if (Number.isNaN(retryDelay)) {
    log.warn(`Received invalid retry-after header value: ${retryAfterHeaderValue}`)
    return retryOptions.retryDelay
  }

  return retryDelay
}

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
    || err.response?.status === 429,
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
