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
import axios, { AxiosInstance, AxiosError, AxiosBasicCredentials } from 'axios'
import axiosRetry from 'axios-retry'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ClientRetryConfig } from './config'
import { ApiConnectionBaseConfig } from './types'
import { DEFAULT_RETRY_OPTS } from './constants'

const log = logger(module)

export type APIConnection = {
  // TODO generalize beyond axios when needed
  get: AxiosInstance['get']
}

export type RetryOptions = {
  retries: number
  retryDelay?: (retryCount: number, error: AxiosError) => number
}

// TODO decide if want this / inheritance / something else
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Credentials = any

export type LoginFunc = (creds: Credentials) => Promise<APIConnection>

export interface Connection {
  login: LoginFunc
}

export type ConnectionCreator = ({ apiConfig, retryOptions }: {
  apiConfig: ApiConnectionBaseConfig
  retryOptions: RetryOptions
}) => Connection

export const createRetryOptions = (retryOptions: Required<ClientRetryConfig>): RetryOptions => ({
  retries: retryOptions.maxAttempts,
  // TODO add retry strategies
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

type ConnectionParams = {
  connection?: Connection
  apiConfig: ApiConnectionBaseConfig
  retryOptions?: RetryOptions
  createConnection: ConnectionCreator
}

export const createClientConnection = ({
  connection,
  apiConfig,
  retryOptions,
  createConnection,
}: ConnectionParams): Connection => (
  connection ?? createConnection({
    apiConfig,
    retryOptions: retryOptions ?? createRetryOptions(DEFAULT_RETRY_OPTS),
  })
)

export const validateCredentials = async (
  creds: Credentials,
  createConnectionArgs: ConnectionParams,
): Promise<string> => {
  const conn = createClientConnection(createConnectionArgs)
  await conn.login(creds)
  // should return account id but not used by default flow
  return '' // TODO needed for SaaS - check details
}

export const axiosConnection = ({
  apiConfig,
  retryOptions,
  authParamsFunc,
  baseURLFunc,
  credValidateFunc,
}: {
  apiConfig: ApiConnectionBaseConfig
  retryOptions: RetryOptions
  authParamsFunc: (creds: Credentials) => {
    auth?: AxiosBasicCredentials
    headers?: Values
  }
  baseURLFunc?: (apiConfig: ApiConnectionBaseConfig, creds: Credentials) => string
  credValidateFunc: (creds: Credentials, conn: APIConnection) => Promise<void>
}): Connection => {
  const login = async (
    creds: Credentials,
  ): Promise<APIConnection> => {
    const httpClient = axios.create({
      // TODO decide if want base-url func (and no base url in config), or to always set it earlier
      baseURL: baseURLFunc !== undefined ? baseURLFunc(apiConfig, creds) : apiConfig.baseUrl,
      ...authParamsFunc(creds),
    })
    axiosRetry(httpClient, retryOptions)

    await credValidateFunc(creds, httpClient)
    return httpClient
  }

  return {
    login,
  }
}
