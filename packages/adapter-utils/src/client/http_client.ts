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
import { logger } from '@salto-io/logging'
import { Connection, ConnectionCreator, createRetryOptions, createClientConnection, ResponseValue } from './http_connection'
import { AdapterClientBase } from './base'
import { GetAllItemsFunc, ClientGetParams } from './pagination'
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

export interface HTTPClientInterface {
  get(params: ClientGetParams): AsyncIterable<ResponseValue[]>
}

export abstract class AdapterHTTPClient<
  TCredentials,
  TRateLimitConfig extends ClientRateLimitConfig,
> extends AdapterClientBase<TRateLimitConfig> implements HTTPClientInterface {
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

  protected abstract getAllItems: GetAllItemsFunc

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
   * Fetch instances of a specific type
   */
  @throttle<TRateLimitConfig>('get', ['url', 'queryParams', 'recursiveQueryParams'])
  @logDecorator(['url', 'queryParams', 'recursiveQueryParams'])
  @requiresLogin()
  public async *get(getParams: ClientGetParams): AsyncIterable<ResponseValue[]> {
    if (this.apiClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} client`)
    }

    try {
      yield* await this.getAllItems({
        conn: this.apiClient,
        pageSize: this.getPageSize,
        getParams,
      })
    } catch (e) {
      log.error(`failed to get ${getParams.url}: ${e}, stack: ${e.stack}`)
      throw new Error(`Failed to get ${getParams.url} with error: ${e}`)
    }
  }
}
