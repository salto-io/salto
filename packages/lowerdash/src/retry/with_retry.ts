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
import { RetryStrategy } from './strategy'
import retryStrategies from './strategies'

export class RetryError extends Error {}

export type RetryOpts = {
  description: string
  strategy: () => RetryStrategy
}

const DEFAULT_OPTS: RetryOpts = Object.freeze({
  strategy: retryStrategies.intervals(),
  description: '',
})

export const timeout = (interval: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, interval)
  })

const withRetry = async <TReturn = boolean>(
  predicate: () => Promise<TReturn>,
  opts: Partial<RetryOpts> = {},
): Promise<TReturn> => {
  const { strategy: retryStrategy, description } = { ...DEFAULT_OPTS, ...opts }
  let retry: RetryStrategy
  const attempt = async (): Promise<TReturn> => {
    const result = await predicate()
    if (result) return result
    retry = retry ?? retryStrategy()
    const retryIn = retry()
    if (typeof retryIn === 'number') {
      await timeout(retryIn)
      return attempt()
    }
    throw new RetryError(`Error while waiting${description ? ` for ${description}` : ''}: ${retryIn}`)
  }
  return attempt()
}

withRetry.DEFAULT_OPTS = DEFAULT_OPTS

export default withRetry
