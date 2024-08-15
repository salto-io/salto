/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { logger } from '@salto-io/logging'

const log = logger(module)

const REQUEST_MAX_RETRIES = 5

export class ReadFileError extends Error {}

export class ReadFileEncodingError extends ReadFileError {}

export class ReadFileInsufficientPermissionError extends ReadFileError {}

export class RetryableError extends Error {
  constructor(readonly originalError: Error) {
    super(originalError.message)
  }
}

export const retryOnRetryableError = async <T>(
  call: () => Promise<T>,
  retriesLeft = REQUEST_MAX_RETRIES,
): Promise<T> => {
  try {
    return await call()
  } catch (e) {
    if (e instanceof RetryableError) {
      if (retriesLeft === 0) {
        log.error('Retryable request exceed max retries with error: %s', e.message)
        throw e.originalError
      }
      return retryOnRetryableError(call, retriesLeft - 1)
    }
    throw e
  }
}
