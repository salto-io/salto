/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { PromiseTimedOutError, withTimeout } from '../../src/promises/timeout'

describe('withTimeout', () => {
  const wait = (
    timeout: number,
  ): Promise<void> => new Promise(resolve => setTimeout(resolve, timeout))

  const waitAndReturn = async <T>(
    timeout: number,
    result: T,
  ): Promise<T> => {
    await wait(timeout)
    return result
  }

  const waitAndReject = async <T>(
    timeout: number,
    error: Error,
  ): Promise<T> => {
    await wait(timeout)
    throw error
  }

  const theResult = { isTheResult: true }
  let p: Promise<typeof theResult | Error>
  const myError = new Error('rejected in test')

  // Workaround for jest bug/misfeature which causes tests to fail
  // if an unhandled exception exists in the node job queue.
  // See: https://github.com/facebook/jest/issues/9210#issuecomment-657568115
  // This is also why we can't use expect(...).rejects in tests here
  const wrapPromiseRejection = <T>(
    promise: Promise<T>,
  ): Promise<T | Error> => promise.catch(e => e)

  describe('when the promise is already resolved', () => {
    beforeEach(async () => {
      p = wrapPromiseRejection(withTimeout(Promise.resolve(theResult), 0))
      await wait(1)
    })
    it('should return it', async () => {
      expect(await p).toBe(theResult)
    })
  })

  describe('when the promise is already rejected', () => {
    beforeEach(async () => {
      p = wrapPromiseRejection(withTimeout(Promise.reject(myError), 0))
      await wait(1)
    })
    it('should reject it with the error', async () => {
      expect(await p).toBe(myError)
    })
  })

  describe('when the promise is resolved before the timeout', () => {
    beforeEach(async () => {
      p = wrapPromiseRejection(withTimeout(waitAndReturn(1, theResult), 3))
      await wait(3)
    })

    it('should return it', async () => {
      expect(await p).toBe(theResult)
    })
  })

  describe('when the promise is resolved after the timeout', () => {
    beforeEach(async () => {
      p = wrapPromiseRejection(withTimeout(waitAndReturn(3, theResult), 1))
      await wait(3)
    })

    it('should reject with a PromiseTimedOutError', async () => {
      expect(await p).toBeInstanceOf(PromiseTimedOutError)
      expect(await p).toMatchObject({ message: 'Promise timed out after 1 ms' })
    })
  })

  describe('when the promise is rejected before the timeout', () => {
    beforeEach(async () => {
      p = wrapPromiseRejection(withTimeout(waitAndReject(1, myError), 3))
      await wait(3)
    })

    it('should reject with the error', async () => {
      expect(await p).toBe(myError)
    })
  })

  describe('when the promise is rejected after the timeout', () => {
    beforeEach(async () => {
      p = wrapPromiseRejection(withTimeout(waitAndReject(3, myError), 1))
      await wait(3)
    })

    it('should reject with the PromiseTimedOutError', async () => {
      expect(await p).toBeInstanceOf(PromiseTimedOutError)
      expect(await p).toMatchObject({ message: 'Promise timed out after 1 ms' })
    })
  })
})
