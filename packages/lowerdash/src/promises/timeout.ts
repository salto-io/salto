/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export class PromiseTimedOutError extends Error {
  constructor(readonly timeout: number) {
    super(`Promise timed out after ${timeout} ms`)
  }
}

export const withTimeout = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new PromiseTimedOutError(timeout))
    }, timeout)
  })
  return Promise.race([promise.finally(() => clearTimeout(timeoutHandle)), timeoutPromise]) as Promise<T>
}

export const sleep = (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return Promise.resolve()
  }
  return new Promise(r => setTimeout(r, delayMs))
}
