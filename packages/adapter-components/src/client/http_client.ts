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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Connection, ConnectionCreator, createRetryOptions, createClientConnection, ResponseValue, Response, APIConnection } from './http_connection'
import { AdapterClientBase } from './base'
import { ClientRetryConfig, ClientRateLimitConfig, ClientPageSizeConfig, ClientBaseConfig } from './config'
import { requiresLogin, logDecorator } from './decorators'
import { throttle } from './rate_limit'

const log = logger(module)

export type ClientOpts<
  TCredentials,
  TRateLimitConfig extends ClientRateLimitConfig,
> = {
  config?: ClientBaseConfig<TRateLimitConfig>
  connection?: Connection<TCredentials>
  credentials: TCredentials
}

export type ClientGetParams = {
  url: string
  queryParams?: Record<string, string>
}

export type ClientPostParams = ClientGetParams & {
  data: unknown
}

export type ClientPutParams = ClientPostParams

export type ClientDeleteParams = ClientGetParams

export type ClientPatchParams = ClientPostParams

export type ClientParams = ClientGetParams | ClientPostParams | ClientPutParams | ClientDeleteParams
  | ClientPatchParams

export interface HTTPReadClientInterface {
  getSinglePage(params: ClientGetParams): Promise<Response<ResponseValue | ResponseValue[]>>
  getPageSize(): number
}

export interface HTTPWriteClientInterface {
  post(params: ClientPostParams): Promise<Response<ResponseValue>>
  put(params: ClientPutParams): Promise<Response<ResponseValue>>
  delete(params: ClientDeleteParams): Promise<Response<ResponseValue>>
  patch(params: ClientPatchParams): Promise<Response<ResponseValue>>
}

export abstract class AdapterHTTPClient<
  TCredentials,
  TRateLimitConfig extends ClientRateLimitConfig,
> extends AdapterClientBase<TRateLimitConfig>
  implements HTTPReadClientInterface, HTTPWriteClientInterface {
  protected readonly conn: Connection<TCredentials>
  private readonly credentials: TCredentials

  constructor(
    clientName: string,
    { credentials, connection, config }: ClientOpts<TCredentials, TRateLimitConfig>,
    createConnection: ConnectionCreator<TCredentials>,
    defaults: {
      retry: Required<ClientRetryConfig>
      rateLimit: Required<TRateLimitConfig>
      pageSize: Required<ClientPageSizeConfig>
    },
  ) {
    super(
      clientName,
      config,
      defaults,
    )
    this.conn = createClientConnection({
      connection,
      retryOptions: createRetryOptions(_.defaults({}, this.config?.retry, defaults.retry)),
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

  /**
   * Get a single response
   */
  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async getSinglePage(params: ClientGetParams):
    Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('get', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'post', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async post(params: ClientPostParams):
    Promise<Response<ResponseValue>> {
    return this.sendRequest('post', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'put', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async put(params: ClientPutParams):
    Promise<Response<ResponseValue>> {
    return this.sendRequest('put', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'delete', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async delete(params: ClientDeleteParams):
    Promise<Response<ResponseValue>> {
    return this.sendRequest('delete', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'patch', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async patch(params: ClientPatchParams):
    Promise<Response<ResponseValue>> {
    return this.sendRequest('patch', params)
  }

  private static isDataParams(params: ClientParams): params is ClientParams & { data: unknown } {
    return 'data' in params
  }

  private async sendRequest<T extends ClientParams>(
    method: keyof APIConnection,
    params: T
  ): Promise<Response<ResponseValue>> {
    if (this.apiClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} client`)
    }

    const { url, queryParams } = params
    try {
      const requestQueryParams = queryParams !== undefined && Object.keys(queryParams).length > 0
        ? { params: queryParams }
        : undefined

      const { data, status } = AdapterHTTPClient.isDataParams(params)
        ? await this.apiClient[method](
          url,
          params.data,
          requestQueryParams,
        )
        : await this.apiClient[method](
          url,
          requestQueryParams,
        )
      log.debug('Received response for %s (%s) with status %d', url, safeJsonStringify({ url, queryParams }), status)
      log.trace('Full HTTP response for %s: %s', url, safeJsonStringify({
        url, queryParams, response: data,
      }))
      return {
        data,
        status,
      }
    } catch (e) {
      log.warn(`failed to ${method} ${url} ${queryParams}: ${e}, stack: ${e.stack}, data: ${safeJsonStringify(e?.response?.data)}`)
      throw new Error(`Failed to ${method} ${url} with error: ${e}`)
    }
  }
}
