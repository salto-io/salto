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
import { ClientRetryConfig, ClientTimeoutConfig } from '../definitions/user/client_config'

export const DEFAULT_RETRY_OPTS: Required<ClientRetryConfig> = {
  maxAttempts: 5, // try 5 times
  retryDelay: 5000, // wait for 5s before trying again
  additionalStatusCodesToRetry: [],
}

export const DEFAULT_TIMEOUT_OPTS: Required<ClientTimeoutConfig> = {
  maxDuration: 0,
  retryOnTimeout: true,
  lastRetryNoTimeout: true,
}

export const RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS = -1
