/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { decorators } from '@salto-io/lowerdash'
import { ClientRateLimitConfig } from '../definitions/user/client_config'
import { logOperationDecorator } from './decorators'
import { RateLimiter } from './rate_limiter'

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
  clientName,
}: {
  rateLimit: Required<TRateLimitConfig>
  maxRequestsPerMinute?: number
  delayPerRequestMS?: number
  useBottleneck?: boolean
  clientName: string
}): RateLimitBuckets<TRateLimitConfig> => {
  const toLimit = (
    num: number | undefined,
    // 0 is an invalid value (blocked in configuration)
  ): number | undefined => (num && num < 0 ? undefined : num)
  const rateLimitConfig = _.mapValues(rateLimit, toLimit)
  log.debug('%s client rate limit config: %o', clientName, rateLimitConfig)

  const intervalOptions =
    (maxRequestsPerMinute ?? 0) > 0
      ? { maxCallsPerInterval: maxRequestsPerMinute, intervalLengthMS: 60 * 1000, carryRunningCallsOver: true }
      : {}

  return _.mapValues(
    rateLimitConfig,
    val =>
      new RateLimiter({
        maxConcurrentCalls: val,
        delayMS: delayPerRequestMS,
        useBottleneck,
        ...intervalOptions,
      }),
  ) as RateLimitBuckets<TRateLimitConfig>
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
    const wrappedCall = this.rateLimiters.total.wrap(async () => originalMethod.call())
    if (bucketName !== undefined && bucketName !== 'total') {
      // we already verified that the bucket exists
      return this.rateLimiters[bucketName].wrap(async () => wrappedCall())()
    }
    return wrappedCall()
  })
