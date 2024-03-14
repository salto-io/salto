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
import { ResponseType } from 'axios'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  Connection,
  ConnectionCreator,
  createRetryOptions,
  createClientConnection,
  ResponseValue,
  Response,
} from './http_connection'
import { AdapterClientBase } from './base'
import {
  ClientRetryConfig,
  ClientRateLimitConfig,
  ClientPageSizeConfig,
  ClientBaseConfig,
  ClientTimeoutConfig,
} from '../definitions/user/client_config'
import { requiresLogin, logDecorator } from './decorators'
import { throttle } from './rate_limit'

const log = logger(module)

const NO_TIMEOUT = 0

export type ClientOpts<TCredentials, TRateLimitConfig extends ClientRateLimitConfig> = {
  config?: ClientBaseConfig<TRateLimitConfig>
  connection?: Connection<TCredentials>
  credentials: TCredentials
}

export type ClientBaseParams = {
  url: string
  queryParams?: Record<string, string | string[]>
  headers?: Record<string, string>
  responseType?: ResponseType
}

export type ClientDataParams = ClientBaseParams & {
  data?: unknown
}

export type ClientParams = ClientBaseParams | ClientDataParams

export interface HTTPReadClientInterface<TAdditionalArgs = {}> {
  get(params: ClientBaseParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  head(params: ClientBaseParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  options(params: ClientBaseParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  getPageSize(): number
}

export interface HTTPWriteClientInterface<TAdditionalArgs = {}> {
  post(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  put(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  delete(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  patch(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
}

export type HttpMethodToClientParams = {
  get: ClientBaseParams
  post: ClientDataParams
  put: ClientDataParams
  patch: ClientDataParams
  delete: ClientDataParams
  head: ClientBaseParams
  options: ClientBaseParams
}

type MethodsWithDataParam = 'put' | 'post' | 'patch'

export class HTTPError extends Error {
  constructor(
    message: string,
    readonly response: Response<ResponseValue>,
  ) {
    super(message)
  }
}

export class TimeoutError extends Error {}

export type ClientDefaults<TRateLimitConfig extends ClientRateLimitConfig> = {
  retry: Required<ClientRetryConfig>
  rateLimit: Required<TRateLimitConfig>
  maxRequestsPerMinute: number
  pageSize: Required<ClientPageSizeConfig>
  timeout?: ClientTimeoutConfig
}

const isMethodWithData = (params: ClientParams): params is ClientDataParams => 'data' in params

// Determines if the given HTTP method uses 'data' as the second parameter, based on APIConnection
const isMethodWithDataParam = <T extends keyof HttpMethodToClientParams>(
  method: T,
): method is T & MethodsWithDataParam => ['put', 'post', 'patch'].includes(method)

export abstract class AdapterHTTPClient<TCredentials, TRateLimitConfig extends ClientRateLimitConfig>
  extends AdapterClientBase<TRateLimitConfig>
  implements HTTPReadClientInterface, HTTPWriteClientInterface
{
  protected readonly conn: Connection<TCredentials>
  protected readonly credentials: TCredentials

  constructor(
    clientName: string,
    { credentials, connection, config }: ClientOpts<TCredentials, TRateLimitConfig>,
    createConnection: ConnectionCreator<TCredentials>,
    defaults: ClientDefaults<TRateLimitConfig>,
  ) {
    super(clientName, config, defaults)
    this.conn = createClientConnection({
      connection,
      retryOptions: createRetryOptions(
        _.defaults({}, this.config?.retry, defaults.retry),
        _.defaults({}, this.config?.timeout, defaults.timeout),
      ),
      timeout: this.config?.timeout?.maxDuration ?? defaults.timeout?.maxDuration ?? NO_TIMEOUT,
      createConnection,
    })
    this.credentials = credentials
  }

  protected async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      if (this.loginPromise === undefined) {
        this.loginPromise = this.conn.login(this.credentials)
      }
      const apiClient = await this.loginPromise
      if (this.apiClient === undefined) {
        this.apiClient = apiClient
        this.isLoggedIn = true
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  protected clearValuesFromResponseData(responseData: Values, _url: string): Values {
    return responseData
  }

  /**
   * Extract headers needed by the adapter
   */
  // eslint-disable-next-line class-methods-use-this
  protected extractHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    return headers !== undefined
      ? // include headers related to rate limits
        _.pickBy(
          headers,
          (_val, key) =>
            key.toLowerCase().startsWith('rate-') ||
            key.toLowerCase().startsWith('x-rate-') ||
            key.toLowerCase().startsWith('retry-'),
        )
      : undefined
  }

  /**
   * Get a single response
   */
  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async get(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('get', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async post(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('post', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async put(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('put', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async delete(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('delete', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async patch(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('patch', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async head(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('head', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async options(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('options', params)
  }

  protected async sendRequest<T extends keyof HttpMethodToClientParams>(
    method: T,
    params: HttpMethodToClientParams[T],
  ): Promise<Response<ResponseValue | ResponseValue[]>> {
    if (this.apiClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} client`)
    }

    const { url, queryParams, headers, responseType } = params
    const data = isMethodWithData(params) ? params.data : undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logResponse = (res: Response<any>): void => {
      log.debug('Received response for %s on %s', method.toUpperCase(), url)

      const responseText = safeJsonStringify({
        url,
        method: method.toUpperCase(),
        status: res.status,
        queryParams,
        response: Buffer.isBuffer(res.data)
          ? `<omitted buffer of length ${res.data.length}>`
          : this.clearValuesFromResponseData(res.data, url),
        headers: this.extractHeaders(res.headers),
        data: Buffer.isBuffer(data) ? `<omitted buffer of length ${data.length}>` : data,
      })

      log.debug('Response size for %s on %s is %d', method.toUpperCase(), url, responseText.length)

      log.trace('Full HTTP response for %s on %s: %s', method.toUpperCase(), url, responseText)
    }

    try {
      const requestConfig = [queryParams, headers, responseType].some(values.isDefined)
        ? {
            params: queryParams,
            headers,
            responseType,
          }
        : undefined

      const res = isMethodWithDataParam(method)
        ? await this.apiClient[method](url, isMethodWithData(params) ? params.data : undefined, requestConfig)
        : await this.apiClient[method](
            url,
            isMethodWithData(params) ? { ...requestConfig, data: params.data } : requestConfig,
          )
      log.debug(
        'Received response for %s on %s (%s) with status %d',
        method.toUpperCase(),
        url,
        safeJsonStringify({ url, queryParams }),
        res.status,
      )
      logResponse(res)
      return {
        data: res.data,
        status: res.status,
        headers: this.extractHeaders(res.headers),
      }
    } catch (e) {
      log.warn(
        `failed to ${method} ${url} ${safeJsonStringify(queryParams)}: ${e}, data: ${safeJsonStringify(e?.response?.data)}, stack: ${e.stack}`,
      )
      if (e.code === 'ETIMEDOUT') {
        throw new TimeoutError(`Failed to ${method} ${url} with error: ${e}`)
      }
      if (e.response !== undefined) {
        logResponse(e.response)
        throw new HTTPError(`Failed to ${method} ${url} with error: ${e}`, {
          status: e.response.status,
          data: e.response.data,
          headers: this.extractHeaders(e.response.headers),
        })
      }
      throw new Error(`Failed to ${method} ${url} with error: ${e}`)
    }
  }
}
