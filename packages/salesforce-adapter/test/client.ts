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
import { Values } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import { mockJsforce } from './connection'
import {
  MAX_TOTAL_CONCURRENT_API_REQUEST,
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
} from '../src/constants'

const mockClient = (
  values?: Values,
): { connection: MockInterface<Connection>; client: SalesforceClient } => {
  const connection = mockJsforce()
  const client = new SalesforceClient({
    credentials: {
      username: 'mockUser',
      password: 'mockPassword',
      isSandbox: false,
    },
    connection,
    config: {
      maxConcurrentApiRequests: {
        total: MAX_TOTAL_CONCURRENT_API_REQUEST,
        retrieve: 3,
        read: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        query: 4,
        describe: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        deploy: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      },
      dataRetry: {
        maxAttempts: 3,
        retryDelay: 100,
        retryDelayMultiplier: 1.2,
        retryableFailures: ['err1', 'err2'],
      },
      ...(values ?? {}),
    },
  })

  return { connection, client }
}

export default mockClient
