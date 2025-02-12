/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

const timeout = (interval: number): Promise<void> =>
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
