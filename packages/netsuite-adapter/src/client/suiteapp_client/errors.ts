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
