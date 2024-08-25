/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ClientRetryConfig, ClientTimeoutConfig } from '../definitions/user/client_config'
import { RateLimiterOptions, RateLimiterRetryOptions } from './rate_limiter'

export const DEFAULT_RETRY_OPTS: Required<ClientRetryConfig> = {
  maxAttempts: 5, // try 5 times
  retryDelay: 5000, // wait for 5s before trying again
  additionalStatusCodesToRetry: [],
  enabledRetry: true,
}

export const DEFAULT_TIMEOUT_OPTS: Required<ClientTimeoutConfig> = {
  maxDuration: 0,
  retryOnTimeout: true,
  lastRetryNoTimeout: true,
}

export const RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS = -1

export const RATE_LIMIT_DEFAULT_RETRY_OPTIONS: RateLimiterRetryOptions = {
  retryPredicate: (): boolean => false,
  calculateRetryDelayMS: (): number => 0,
  pauseDuringRetryDelay: false,
}

export const RATE_LIMIT_DEFAULT_OPTIONS: RateLimiterOptions = {
  maxConcurrentCalls: Infinity,
  maxCallsPerInterval: Infinity,
  intervalLengthMS: 0,
  carryRunningCallsOver: true,
  delayMS: 0,
  startPaused: false,
  useBottleneck: true,
  ...RATE_LIMIT_DEFAULT_RETRY_OPTIONS,
}

export const DEFAULT_RETRY_IN_RATE_LIMITER = !DEFAULT_RETRY_OPTS.enabledRetry
