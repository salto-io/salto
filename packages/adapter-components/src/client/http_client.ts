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
import { Connection, ConnectionCreator, createRetryOptions, createClientConnection, ResponseValue, Response } from './http_connection'
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

export type ClientBaseParams = {
  url: string
  queryParams?: Record<string, string>
}

export type ClientDataParams = ClientBaseParams & {
  data: unknown
}

export type ClientParams = ClientBaseParams | ClientDataParams

export interface HTTPReadClientInterface {
  getSinglePage(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>>
  getPageSize(): number
}

export interface HTTPWriteClientInterface {
  post(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>>
  put(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>>
  delete(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>>
  patch(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>>
}

type HttpMethodToClientParams = {
  get: ClientBaseParams
  post: ClientDataParams
  put: ClientDataParams
  patch: ClientDataParams
  delete: ClientBaseParams
}

const isMethodWithData = (params: ClientParams): params is ClientDataParams =>
  'data' in params

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
  public async getSinglePage(params: ClientBaseParams):
    Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('get', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async post(params: ClientDataParams):
    Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('post', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async put(params: ClientDataParams):
    Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('put', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async delete(params: ClientBaseParams):
    Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('delete', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async patch(params: ClientDataParams):
    Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('patch', params)
  }

  private async sendRequest<T extends keyof HttpMethodToClientParams>(
    method: T,
    params: HttpMethodToClientParams[T]
  ): Promise<Response<ResponseValue | ResponseValue[]>> {
    if (this.apiClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} client`)
    }

    const { url, queryParams } = params
    try {
      const requestQueryParams = queryParams !== undefined && Object.keys(queryParams).length > 0
        ? { params: queryParams }
        : undefined

      const { data, status } = isMethodWithData(params)
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
