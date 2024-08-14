/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { AdapterHTTPClient, ClientDefaults, ClientOpts } from './http_client'
import { ClientRateLimitConfig } from '../definitions'
import { ConnectionCreator } from './http_connection'
import {
  DEFAULT_RETRY_OPTS,
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  RATE_LIMIT_DEFAULT_OPTIONS,
} from './constants'

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
  delayPerRequestMS: RATE_LIMIT_DEFAULT_OPTIONS.delayMS,
  useBottleneck: RATE_LIMIT_DEFAULT_OPTIONS.useBottleneck,
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
}): AdapterHTTPClient<Credentials, ClientRateLimitConfig> => new (clientCls ?? Client)(args)
