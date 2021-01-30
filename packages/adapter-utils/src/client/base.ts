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
import Bottleneck from 'bottleneck'
import { decorators } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ClientBaseConfig, ClientRateLimitConfig, ClientRetryConfig, ClientPageSizeConfig } from './config'
import {
  ApiConnectionBaseConfig, ClientOptsBase,
} from './types'
import { APIConnection } from './http_connection'

const log = logger(module)

type RateLimitBucketName = keyof ClientRateLimitConfig

const createRateLimitersFromConfig = (
  rateLimit: Required<ClientRateLimitConfig>,
  clientName: string,
): Record<RateLimitBucketName, Bottleneck> => {
  const toLimit = (
    num: number | undefined
  // 0 is an invalid value (blocked in configuration)
  ): number | undefined => (num && num < 0 ? undefined : num)
  const rateLimitConfig = _.mapValues(rateLimit, toLimit)
  log.debug('%s client rate limit config: %o', clientName, rateLimitConfig)
  return _.mapValues(rateLimitConfig, val => new Bottleneck({ maxConcurrent: val }))
}

type LogDescFunc = (origCall: decorators.OriginalCall) => string
const logOperationDecorator = (clientName: string, keys?: string[]): LogDescFunc => ((
  { name, args }: decorators.OriginalCall,
) => {
  const printableArgs = args
    .map(arg => {
      const keysValues = (keys ?? [])
        .map(key => _.get(arg, key))
        .filter(_.isString)
      return _.isEmpty(keysValues) ? arg : keysValues.join(', ')
    })
    .filter(_.isString)
    .join(', ')
  return `${clientName}:client.${name}(${printableArgs})`
})

export abstract class AdapterClientBase {
  protected isLoggedIn = false
  protected readonly config?: ClientBaseConfig
  protected readonly apiConfig: ApiConnectionBaseConfig
  protected readonly rateLimiters: Record<RateLimitBucketName, Bottleneck>
  protected getPageSize: number
  protected apiClient?: APIConnection
  protected loginPromise?: Promise<APIConnection>

  constructor(
    { config, api }: ClientOptsBase,
    defaults: {
      retry: Required<ClientRetryConfig>
      rateLimit: Required<ClientRateLimitConfig>
      pageSize: Required<ClientPageSizeConfig>
    },
  ) {
    this.config = config
    this.apiConfig = api
    this.rateLimiters = createRateLimitersFromConfig(
      _.defaults({}, config?.rateLimit, defaults.rateLimit),
      this.clientName(),
    )
    this.getPageSize = (
      this.config?.pageSize?.get
      ?? defaults.pageSize.get
    )
  }

  protected abstract clientName(): string

  protected abstract async ensureLoggedIn(): Promise<void>

  protected static requiresLogin = decorators.wrapMethodWith(
    async function withLogin(
      this: AdapterClientBase,
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureLoggedIn()
      return originalMethod.call()
    }
  )

  protected static throttle = (
    bucketName?: RateLimitBucketName,
    keys?: string[],
  ): decorators.InstanceMethodDecorator =>
    decorators.wrapMethodWith(
      async function withRateLimit(
        this: AdapterClientBase,
        originalMethod: decorators.OriginalCall,
      ): Promise<unknown> {
        log.debug('%s enqueued', logOperationDecorator(this.clientName(), keys)(originalMethod))
        const wrappedCall = this.rateLimiters.total.wrap(async () => originalMethod.call())
        if (bucketName !== undefined && bucketName !== 'total') {
          if (this.rateLimiters[bucketName] !== undefined) {
            return this.rateLimiters[bucketName].wrap(async () => wrappedCall())()
          }
          // should not happen, but we don't want to fail at runtime
          log.error('unsupported bucket %s for client %s - only using total limit', bucketName, this.clientName())
        }
        return wrappedCall()
      }
    )

  protected static logDecorator = (keys?: string[]): decorators.InstanceMethodDecorator =>
    decorators.wrapMethodWith(
      // eslint-disable-next-line prefer-arrow-callback
      async function logFailure(
        this: AdapterClientBase,
        originalMethod: decorators.OriginalCall,
      ): Promise<unknown> {
        const desc = logOperationDecorator(this.clientName(), keys)(originalMethod)
        try {
          return await log.time(originalMethod.call, desc)
        } catch (e) {
          log.error('failed to run client call %s: %s', desc, e.message)
          throw e
        }
      }
    )
}
