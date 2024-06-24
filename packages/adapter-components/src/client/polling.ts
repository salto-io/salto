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
import { retry } from '@salto-io/lowerdash'
import { ResponseValue, Response } from './http_connection'
import { PollingArgs } from '../definitions'
import { HTTPError } from './http_client'

const {
  withRetry,
  retryStrategies: { intervals },
} = retry

export const executeWithPolling = async <T>(
  args: T,
  polling: PollingArgs,
  singleClientCall: (args: T) => Promise<Response<ResponseValue | ResponseValue[]>>,
): Promise<Response<ResponseValue | ResponseValue[]>> => {
  const pollingFunc = async (): Promise<Response<ResponseValue | ResponseValue[]> | undefined> => {
    try {
      const response = await singleClientCall(args)
      return polling.checkStatus(response) ? response : undefined
    } catch (e) {
      if (e instanceof HTTPError && polling.retryOnStatus?.includes(e.response?.status)) {
        return undefined
      }
      throw e
    }
  }
  const pollingResult = await withRetry(() => pollingFunc(), {
    strategy: intervals({ maxRetries: polling.retries, interval: polling.interval }),
  })
  if (pollingResult === undefined) {
    // should never get here, withRetry would throw
    throw new Error('Error while waiting for polling')
  }
  return pollingResult
}
