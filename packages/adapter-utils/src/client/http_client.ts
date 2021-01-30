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
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ClientOptsBase, ClientGetParams } from './types'
import { Connection, APIConnection, ConnectionCreator, Credentials, createRetryOptions, createClientConnection } from './http_connection'
import { AdapterClientBase } from './base'
import { GetAllItemsFunc } from './pagination'
import { ClientRetryConfig, ClientRateLimitConfig, ClientPageSizeConfig } from './config'

const log = logger(module)

export type ClientOpts<TCred extends Credentials> = ClientOptsBase & {
  connection?: Connection
  credentials: TCred
}

export interface HTTPClientInterface {
  get(params: ClientGetParams): Promise<{ result: Values[]; errors: string[]}>
}

export const loginFromCredentials = async <TCred>(conn: Connection, creds: TCred):
    Promise<APIConnection> => (
  conn.login(creds)
)

export abstract class AdapterHTTPClient<
  TCred extends Credentials
> extends AdapterClientBase implements HTTPClientInterface {
  protected readonly conn: Connection
  private readonly credentials: Credentials

  constructor(
    { credentials, connection, config, api }: ClientOpts<TCred>,
    createConnection: ConnectionCreator,
    defaults: {
      retry: Required<ClientRetryConfig>
      rateLimit: Required<ClientRateLimitConfig>
      pageSize: Required<ClientPageSizeConfig>
    },
  ) {
    super(
      { config, api },
      defaults,
    )
    this.conn = createClientConnection({
      connection,
      apiConfig: this.apiConfig,
      retryOptions: createRetryOptions(_.defaults({}, this.config?.retry, defaults.retry)),
      createConnection,
    })
    this.credentials = credentials
  }

  protected abstract getAllItems: GetAllItemsFunc

  protected async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      if (this.loginPromise === undefined) {
        this.loginPromise = loginFromCredentials(this.conn, this.credentials)
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
  @AdapterHTTPClient.throttle('get', ['endpointName', 'queryArgs', 'recursiveQueryArgs'])
  @AdapterHTTPClient.logDecorator(['endpointName', 'queryArgs', 'recursiveQueryArgs'])
  @AdapterHTTPClient.requiresLogin
  public async get(getParams: ClientGetParams): Promise<{ result: Values[]; errors: string[]}> {
    if (this.apiClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName()} client`)
    }

    try {
      const allResults = await this.getAllItems({
        client: this.apiClient,
        pageSize: this.getPageSize,
        getParams,
      })

      return {
        result: allResults,
        errors: [],
      }
    } catch (e) {
      log.error(`failed to get ${getParams.endpointName}: ${e}, stack: ${e.stack}`)
      return {
        result: [],
        errors: [e],
      }
    }
  }
}
