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
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { createConnection } from './connection'
import { SAP } from '../constants'
import { Credentials } from '../auth'

const { DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } = clientUtils

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
      retry: DEFAULT_RETRY_OPTS,
      timeout: DEFAULT_TIMEOUT_OPTS,
    })
  }
}
