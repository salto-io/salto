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
import {
  ClientBaseConfig,
  ClientRateLimitConfig,
  ClientRetryConfig,
  ClientPageSizeConfig,
} from '../definitions/user/client_config'
import { APIConnection } from './http_connection'
import { BottleneckBuckets, createRateLimitersFromConfig } from './rate_limit'

export abstract class AdapterClientBase<TRateLimitConfig extends ClientRateLimitConfig> {
  readonly clientName: string
  protected isLoggedIn = false
  protected readonly config?: ClientBaseConfig<TRateLimitConfig>
  protected readonly rateLimiters: BottleneckBuckets<TRateLimitConfig>
  protected apiClient?: APIConnection
  protected loginPromise?: Promise<APIConnection>
  private getPageSizeInner: number

  constructor(
    clientName: string,
    config: ClientBaseConfig<TRateLimitConfig> | undefined,
    defaults: {
      retry: Required<ClientRetryConfig>
      rateLimit: Required<TRateLimitConfig>
      maxRequestsPerMinute: number
      pageSize: Required<ClientPageSizeConfig>
    },
  ) {
    this.clientName = clientName
    this.config = config
    this.rateLimiters = createRateLimitersFromConfig<TRateLimitConfig>({
      rateLimit: _.defaults({}, config?.rateLimit, defaults.rateLimit),
      clientName: this.clientName,
      maxRequestsPerMinute: config?.maxRequestsPerMinute ?? defaults.maxRequestsPerMinute,
    })
    this.getPageSizeInner = this.config?.pageSize?.get ?? defaults.pageSize.get
  }

  getPageSize(): number {
    return this.getPageSizeInner
  }
}
