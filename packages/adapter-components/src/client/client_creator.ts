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
import { AdapterHTTPClient, ClientDefaults, ClientOpts } from './http_client'
import { ClientRateLimitConfig } from '../definitions'
import { ConnectionCreator } from './http_connection'
import { DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } from './constants'

interface ClientConstructor<Credentials> {
  new (args: {
    adapterName: string
    createConnection: ConnectionCreator<Credentials>
    clientOpts: ClientOpts<Credentials, ClientRateLimitConfig>
    clientDefaults?: Partial<Omit<ClientDefaults<ClientRateLimitConfig>, 'pageSize'>>
  }): AdapterHTTPClient<Credentials, ClientRateLimitConfig>
}

const CLIENT_UNLIMITED_DEFAULTS: Omit<ClientDefaults<ClientRateLimitConfig>, 'pageSize'> = {
  rateLimit: {
    total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    get: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    deploy: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  },
  maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  retry: DEFAULT_RETRY_OPTS,
}

export class Client<Credentials> extends AdapterHTTPClient<Credentials, ClientRateLimitConfig> {
  constructor({
    adapterName,
    clientDefaults,
    clientOpts,
    createConnection,
  }: {
    adapterName: string
    createConnection: ConnectionCreator<Credentials>
    clientOpts: ClientOpts<Credentials, ClientRateLimitConfig>
    clientDefaults?: Partial<Omit<ClientDefaults<ClientRateLimitConfig>, 'pageSize'>>
  }) {
    super(
      adapterName,
      clientOpts,
      createConnection,
      _.defaults(
        {
          pageSize: { get: 100 }, // not used by the new infra, TODO remove in SALTO-5538
        },
        clientDefaults,
        CLIENT_UNLIMITED_DEFAULTS,
      ),
    )
  }
}

export const createClient = <
  Credentials,
  P extends ClientOpts<Credentials, ClientRateLimitConfig> = ClientOpts<Credentials, ClientRateLimitConfig>,
>({
  clientCls,
  ...args
}: {
  adapterName: string
  clientOpts: P
  createConnection: ConnectionCreator<Credentials>
  clientCls?: ClientConstructor<Credentials>
  clientDefaults?: Partial<Omit<ClientDefaults<ClientRateLimitConfig>, 'pageSize'>>
}): AdapterHTTPClient<Credentials, ClientRateLimitConfig> =>
  // eslint-disable-next-line new-cap
  new (clientCls ?? Client)(args)
