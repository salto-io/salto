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
import { logger } from '@salto-io/logging'
import { decorators } from '@salto-io/lowerdash'
import { ClientRateLimitConfig, ClientRetryConfig, ClientTimeoutConfig } from '../definitions/user/client_config'
import { logOperationDecorator } from './decorators'
import { RateLimiter, RateLimiterRetryOptions } from './rate_limiter'
import { createRetryOptions } from './http_connection'

const log = logger(module)

type RateLimitExtendedConfig = ClientRateLimitConfig & Record<string, number | undefined>

export type RateLimitBuckets<TRateLimitConfig> = {
  [P in keyof Required<TRateLimitConfig>]: RateLimiter
}

export const createRateLimitersFromConfig = <TRateLimitConfig extends RateLimitExtendedConfig>({
  rateLimit,
  maxRequestsPerMinute,
  delayPerRequestMS,
  useBottleneck,
  pauseDuringRetryDelay,
  clientName,
  retryConfig,
  timeoutConfig,
}: {
  rateLimit: Required<TRateLimitConfig>
  maxRequestsPerMinute?: number
  delayPerRequestMS?: number
  useBottleneck?: boolean
  pauseDuringRetryDelay?: boolean
  clientName: string
  retryConfig?: Required<ClientRetryConfig>
  timeoutConfig?: ClientTimeoutConfig
}): RateLimitBuckets<TRateLimitConfig> => {
  const toLimit = (
    num: number | undefined,
    // 0 is an invalid value (blocked in configuration)
  ): number | undefined => (num && num < 0 ? undefined : num)
  const rateLimitConfig = _.mapValues(rateLimit, toLimit)
  log.debug('%s client rate limit config: %o', clientName, rateLimitConfig)
  log.debug('%s client rate limit retry config: %o', clientName, retryConfig)
  log.debug('%s client rate limit timeout config: %o', clientName, timeoutConfig)

  const retryOptions: Partial<RateLimiterRetryOptions> = { pauseDuringRetryDelay }
  if (retryConfig !== undefined) {
    const axiosRetryOptions = createRetryOptions(retryConfig, timeoutConfig)
    retryOptions.calculateRetryDelayMS = axiosRetryOptions.retryDelay
    retryOptions.retryPredicate = (numAttempts, error) =>
      numAttempts <= retryConfig.maxAttempts &&
      axiosRetryOptions.retryCondition !== undefined &&
      axiosRetryOptions.retryCondition(error)
  }

  const intervalOptions =
    (maxRequestsPerMinute ?? 0) > 0
      ? { maxCallsPerInterval: maxRequestsPerMinute, intervalLengthMS: 60 * 1000, carryRunningCallsOver: true }
      : {}
  return _.defaults(
    {
      total: new RateLimiter(
        {
          maxConcurrentCalls: rateLimitConfig.total,
          delayMS: delayPerRequestMS,
          useBottleneck,
          pauseDuringRetryDelay,
          ...intervalOptions,
          ...retryOptions,
        },
        'total',
      ),
    },
    _.mapValues(
      rateLimitConfig,
      (val, key) =>
        new RateLimiter(
          {
            maxConcurrentCalls: val,
            delayMS: delayPerRequestMS,
            useBottleneck,
            pauseDuringRetryDelay,
            ...intervalOptions,
          },
          key,
        ),
    ) as RateLimitBuckets<TRateLimitConfig>,
  )
}

type ThrottleParameters<TRateLimitConfig extends ClientRateLimitConfig> = {
  bucketName?: keyof Required<TRateLimitConfig>
  keys?: string[]
}

export const throttle = <TRateLimitConfig extends ClientRateLimitConfig>({
  bucketName,
  keys,
}: ThrottleParameters<TRateLimitConfig>): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(async function withRateLimit(
    this: {
      clientName: string
      rateLimiters: RateLimitBuckets<TRateLimitConfig>
    },
    originalMethod: decorators.OriginalCall,
  ): Promise<unknown> {
    log.debug('%s enqueued', logOperationDecorator(originalMethod, this.clientName, keys))
    if (bucketName !== undefined) {
      // we already verified that the bucket exists
      return this.rateLimiters[bucketName].wrap(async () => originalMethod.call())()
    }
    return originalMethod.call()
  })
