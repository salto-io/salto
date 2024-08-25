/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { createConnection } from './connection'
import { SAP } from '../constants'
import { Credentials } from '../auth'

const {
  DEFAULT_RETRY_OPTS,
  DEFAULT_TIMEOUT_OPTS,
  DEFAULT_RETRY_IN_RATE_LIMITER,
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  RATE_LIMIT_DEFAULT_OPTIONS,
} = clientUtils

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<definitions.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  get: 50,
  deploy: 50,
}

const DEFAULT_PAGE_SIZE: Required<definitions.ClientPageSizeConfig> = {
  get: 100,
}

export default class SapClient extends clientUtils.AdapterHTTPClient<Credentials, definitions.ClientRateLimitConfig> {
  constructor(clientOpts: clientUtils.ClientOpts<Credentials, definitions.ClientRateLimitConfig>) {
    super(SAP, clientOpts, createConnection, {
      pageSize: DEFAULT_PAGE_SIZE,
      rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      delayPerRequestMS: RATE_LIMIT_DEFAULT_OPTIONS.delayMS,
      useBottleneck: RATE_LIMIT_DEFAULT_OPTIONS.useBottleneck,
      pauseDuringRetryDelay: RATE_LIMIT_DEFAULT_OPTIONS.pauseDuringRetryDelay,
      retryInRateLimiter: DEFAULT_RETRY_IN_RATE_LIMITER,
      retry: DEFAULT_RETRY_OPTS,
      timeout: DEFAULT_TIMEOUT_OPTS,
    })
  }
}
