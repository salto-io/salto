/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
      if (polling.retryOnStatus?.includes(e.response?.status)) {
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
