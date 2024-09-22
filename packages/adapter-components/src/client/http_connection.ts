/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import axios, {
  AxiosError,
  AxiosBasicCredentials,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponseHeaders,
} from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import { AccountInfo, CredentialError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ClientRetryConfig, ClientTimeoutConfig } from '../definitions/user/client_config'
import { DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS } from './constants'

const log = logger(module)

export class UnauthorizedError extends CredentialError {}

export type ResponseValue = {
  [key: string]: unknown
}

export type Response<T> = {
  data: T
  status: number
  statusText?: string
  headers?: Partial<AxiosResponseHeaders>
  requestPath?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type APIConnection<T = any, S = any> = {
  // based on https://github.com/axios/axios/blob/f472e5da5fe76c72db703d6a0f5190e4ad31e642/index.d.ts#L140
  get: (url: string, config?: AxiosRequestConfig) => Promise<Response<T>>
  post: (url: string, data: S, config?: AxiosRequestConfig) => Promise<Response<T>>
  put: (url: string, data: S, config?: AxiosRequestConfig) => Promise<Response<T>>
  delete: (url: string, config?: AxiosRequestConfig) => Promise<Response<T>>
  patch: (url: string, data: S, config?: AxiosRequestConfig) => Promise<Response<T>>
  head: (url: string, config?: AxiosRequestConfig) => Promise<Response<T>>
  options: (url: string, config?: AxiosRequestConfig) => Promise<Response<T>>
}

export type AuthenticatedAPIConnection = APIConnection & {
  accountInfo: AccountInfo
}

export type RetryOptions = Partial<IAxiosRetryConfig>

type LoginFunc<TCredentials> = (credentials: TCredentials) => Promise<AuthenticatedAPIConnection>

export interface Connection<TCredentials> {
  login: LoginFunc<TCredentials>
}

export type ConnectionCreator<TCredentials> = (retryOptions: RetryOptions, timeout?: number) => Connection<TCredentials>

const getRetryDelayFromHeaders = (headers: Partial<AxiosResponseHeaders>): number | undefined => {
  // Although the standard is 'Retry-After' is seems that some servers
  // returns 'retry-after' so just in case we lowercase the headers
  const lowercaseHeaders = _.mapKeys(headers, (_val, key) => key.toLowerCase())

  const retryAfterHeaderValue = lowercaseHeaders['retry-after']
  if (retryAfterHeaderValue !== undefined) {
    const retryAfter = parseInt(retryAfterHeaderValue, 10) * 1000
    if (Number.isNaN(retryAfter)) {
      log.warn(`Received invalid retry-after header value: ${retryAfterHeaderValue}`)
      return undefined
    }
    log.trace(`Received retry-after header value: ${retryAfter}`)
    return retryAfter
  }
  // Handle rate limits as seen in Okta,
  // x-rate-limit-reset contains the time at which the rate limit resets
  // more information: https://developer.okta.com/docs/reference/rl-best-practices/
  // it will not work for Jira (https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
  // as they give it in a date format. currently we do not see it happening
  const rateLimitResetHeaderValue = lowercaseHeaders['x-rate-limit-reset']
  if (rateLimitResetHeaderValue !== undefined && lowercaseHeaders.date !== undefined) {
    const resetTime = parseInt(rateLimitResetHeaderValue, 10) * 1000
    const currentTime = new Date(lowercaseHeaders.date).getTime()
    if (Number.isNaN(resetTime) || Number.isNaN(currentTime)) {
      log.warn(`Received invalid x-rate-limit-reset values: ${rateLimitResetHeaderValue}, ${lowercaseHeaders.date}`)
      return undefined
    }
    log.trace(
      `Received x-rate-limit-reset value: ${rateLimitResetHeaderValue} matched with date: ${lowercaseHeaders.date}`,
    )
    return resetTime - currentTime
  }
  return undefined
}

const getRetryDelay = (retryOptions: Required<ClientRetryConfig>, error: AxiosError): number => {
  const retryDelay = getRetryDelayFromHeaders(error.response?.headers ?? {}) ?? retryOptions.retryDelay

  return retryDelay
}

const shouldRetryStatusCode = (statusCode?: number, additionalStatusesToRetry: number[] = []): boolean =>
  statusCode !== undefined && [429, ...additionalStatusesToRetry].includes(statusCode)

const shouldRetryOnTimeout = (errorCode: string | undefined, retryOnTimeout: boolean | undefined): boolean =>
  // axios returns ECONNABORTED on timeouts, but servers can sometimes return ETIMEDOUT
  retryOnTimeout ? ['ECONNABORTED', 'ETIMEDOUT'].includes(errorCode ?? '') : false

export const createRetryOptions = (
  retryOptions: Required<ClientRetryConfig>,
  timeoutOptions?: ClientTimeoutConfig,
): RetryOptions => ({
  retries: retryOptions.maxAttempts,
  retryDelay: (retryCount, err) => {
    const retryDelay = getRetryDelay(retryOptions, err)

    log.warn(
      'Failed to run client call to %s for reason: %s (%s). Retrying in %ds (attempt %d).',
      err.config?.url,
      err.code,
      err.message,
      retryDelay / 1000,
      retryCount,
    )
    return retryDelay
  },
  // We use isNetworkError and isSafeRequestError instead of isNetworkOrIdempotentRequestError
  // because we don't want to assume all adapters are idempotent on PUT or DELETE requests
  retryCondition: err =>
    axiosRetry.isNetworkError(err) ||
    axiosRetry.isSafeRequestError(err) ||
    shouldRetryStatusCode(err.response?.status, retryOptions.additionalStatusCodesToRetry) ||
    shouldRetryOnTimeout(err.code, timeoutOptions?.retryOnTimeout),
  // Note that changing the config is consistent on all retries. For the current use-case, that's fine,
  // as we are updating the last retry.
  onRetry: (retryCount, _err, requestConfig) => {
    if (timeoutOptions?.lastRetryNoTimeout && retryCount === retryOptions.maxAttempts) {
      requestConfig.timeout = 0
    }
  },
  // When false, axios-retry interprets the request timeout as a global value,
  // so it is not used for each retry but for the whole request lifecycle.
  // In our case, if the user wants to retry on timeouts, we need to reset it per retry.
  shouldResetTimeout: timeoutOptions?.retryOnTimeout,
})

export type ConnectionParams<TCredentials> = {
  connection?: Connection<TCredentials>
  retryOptions?: RetryOptions
  timeout?: number
  createConnection: ConnectionCreator<TCredentials>
}

export const createClientConnection = <TCredentials>({
  connection,
  retryOptions,
  timeout = DEFAULT_TIMEOUT_OPTS.maxDuration,
  createConnection,
}: ConnectionParams<TCredentials>): Connection<TCredentials> =>
  connection ??
  createConnection(_.defaults({}, retryOptions, createRetryOptions(DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS)), timeout)

export const validateCredentials = async <TCredentials>(
  credentials: TCredentials,
  createConnectionArgs: ConnectionParams<TCredentials>,
): Promise<AccountInfo> => {
  const conn = createClientConnection(createConnectionArgs)
  const { accountInfo } = await conn.login(credentials)
  return accountInfo
}

export type AuthParams = {
  auth?: AxiosBasicCredentials
  headers?: Partial<AxiosRequestHeaders>
}

type AxiosConnectionParams<TCredentials> = {
  retryOptions: RetryOptions
  authParamsFunc: (credentials: TCredentials) => Promise<AuthParams>
  baseURLFunc: (credentials: TCredentials) => Promise<string>
  credValidateFunc: ({
    credentials,
    connection,
  }: {
    credentials: TCredentials
    connection: APIConnection
  }) => Promise<AccountInfo>
  timeout?: number
}

export const axiosConnection = <TCredentials>({
  retryOptions,
  authParamsFunc,
  baseURLFunc,
  credValidateFunc,
  timeout = 0,
}: AxiosConnectionParams<TCredentials>): Connection<TCredentials> => {
  const login = async (credentials: TCredentials): Promise<AuthenticatedAPIConnection> => {
    const httpClient = axios.create({
      baseURL: await baseURLFunc(credentials),
      ...(await authParamsFunc(credentials)),
      maxBodyLength: Infinity,
    })
    httpClient.interceptors.request.use(
      config => {
        config.timeout = timeout
        return config
      },
      null,
      { runWhen: config => ['get', 'head', 'options'].includes(config.method ?? '') },
    )
    axiosRetry(httpClient, retryOptions)

    try {
      const accountInfo = await credValidateFunc({ credentials, connection: httpClient })
      return Object.assign(httpClient, { accountInfo })
    } catch (e) {
      log.error(`Login failed: ${e}, stack: ${e.stack}`)
      if (e.response?.status === 401 || e instanceof UnauthorizedError) {
        throw new UnauthorizedError('Unauthorized - update credentials and try again')
      }
      throw new Error(`Login failed with error: ${e.message ?? e}`)
    }
  }

  return {
    login,
  }
}
