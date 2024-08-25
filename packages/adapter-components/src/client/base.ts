/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ClientBaseConfig, ClientRateLimitConfig } from '../definitions/user/client_config'
import { APIConnection } from './http_connection'
import { RateLimitBuckets, createRateLimitersFromConfig } from './rate_limit'
import { ClientDefaults } from './http_client'

export abstract class AdapterClientBase<TRateLimitConfig extends ClientRateLimitConfig> {
  readonly clientName: string
  protected isLoggedIn = false
  protected readonly config?: ClientBaseConfig<TRateLimitConfig>
  protected readonly rateLimiters: RateLimitBuckets<TRateLimitConfig>
  protected apiClient?: APIConnection
  protected loginPromise?: Promise<APIConnection>
  private getPageSizeInner: number

  constructor(
    clientName: string,
    config: ClientBaseConfig<TRateLimitConfig> | undefined,
    defaults: ClientDefaults<TRateLimitConfig>,
  ) {
    const concreteConfig = {
      ...config,
      retry: { ...defaults.retry, ...config?.retry },
      timeout: { ...defaults.timeout, ...config?.timeout },
    }
    const originalEnabledRetry = concreteConfig.retry.enabledRetry
    concreteConfig.retry.enabledRetry &&= !(config?.retryInRateLimiter ?? defaults.retryInRateLimiter)
    this.config = { ...concreteConfig }

    this.clientName = clientName
    this.rateLimiters = createRateLimitersFromConfig<TRateLimitConfig>({
      rateLimit: _.defaults({}, config?.rateLimit, defaults.rateLimit),
      clientName: this.clientName,
      maxRequestsPerMinute: config?.maxRequestsPerMinute ?? defaults.maxRequestsPerMinute,
      delayPerRequestMS: config?.delayPerRequestMS ?? defaults.delayPerRequestMS,
      useBottleneck: config?.useBottleneck ?? defaults.useBottleneck,
      pauseDuringRetryDelay: config?.pauseDuringRetryDelay ?? defaults.pauseDuringRetryDelay,
      retryConfig: { ...concreteConfig.retry, enabledRetry: originalEnabledRetry },
      timeoutConfig: concreteConfig.timeout,
    })
    this.getPageSizeInner = this.config?.pageSize?.get ?? defaults.pageSize.get
  }

  getPageSize(): number {
    return this.getPageSizeInner
  }
}
