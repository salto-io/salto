/*
*                      Copyright 2021 Salto Labs Ltd.
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
import axios, { AxiosError, AxiosBasicCredentials } from 'axios'
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
export type GetResponse<T = any> = {
  data: T
  status: number
  statusText?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type APIConnection<T = any> = {
  // based on https://github.com/axios/axios/blob/f472e5da5fe76c72db703d6a0f5190e4ad31e642/index.d.ts#L140
  get: (url: string, config?: { params: Record<string, unknown> }) => Promise<GetResponse<T>>
}

type AuthenticatedAPIConnection = APIConnection & {
  accountId: AccountId
}

type RetryOptions = {
  retries: number
  retryDelay?: (retryCount: number, error: AxiosError) => number
}

type LoginFunc<TCredentials> = (creds: TCredentials) => Promise<AuthenticatedAPIConnection>

export interface Connection<TCredentials> {
  login: LoginFunc<TCredentials>
}

export type ConnectionCreator<TCredentials> = (
  retryOptions: RetryOptions,
) => Connection<TCredentials>

export const createRetryOptions = (retryOptions: Required<ClientRetryConfig>): RetryOptions => ({
  retries: retryOptions.maxAttempts,
  retryDelay: (retryCount, err) => {
    log.error('Failed to run client call to %s for reason: %s (%s). Retrying in %ds (attempt %d).',
      err.config.url,
      err.code,
      err.message,
      retryOptions.retryDelay / 1000,
      retryCount)
    return retryOptions.retryDelay
  },
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

type AxiosConnectionParams<TCredentials> = {
  retryOptions: RetryOptions
  authParamsFunc: (creds: TCredentials) => {
    auth?: AxiosBasicCredentials
    headers?: Record<string, unknown>
  }
  baseURLFunc: (creds: TCredentials) => string
  credValidateFunc: (creds: TCredentials, conn: APIConnection) => Promise<AccountId>
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
      ...authParamsFunc(creds),
    })
    axiosRetry(httpClient, retryOptions)

    try {
      const accountId = await credValidateFunc(creds, httpClient)
      return {
        ...httpClient,
        accountId,
      }
    } catch (e) {
      log.error(`Login failed: ${e}, stack: ${e.stack}`)
      if (e.response?.status === 401) {
        throw new UnauthorizedError('Unauthorized - update credentials and try again')
      }
      throw new Error(`Login failed with error: ${e}`)
    }
  }

  return {
    login,
  }
}
