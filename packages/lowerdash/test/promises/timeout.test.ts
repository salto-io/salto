/*
*                      Copyright 2023 Salto Labs Ltd.
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
import _ from 'lodash'
import { PromiseTimedOutError, withTimeout, sleep } from '../../src/promises/timeout'

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
  const myError = new Error('rejected in test')

  // Workaround for jest bug/misfeature which causes tests to fail
  // if an unhandled exception exists in the node job queue.
  // See: https://github.com/facebook/jest/issues/9210#issuecomment-657568115
  // This is also why we can't use expect(...).rejects in tests here
  const wrapPromiseRejection = <T>(
    promise: Promise<T>,
  ): Promise<T | Error> => promise.catch(e => e)

  describe('when the promise is already resolved', () => {
    it('should return it', async () => {
      const p = wrapPromiseRejection(withTimeout(Promise.resolve(theResult), 0))
      await wait(1)
      expect(await p).toBe(theResult)
    })
  })

  describe('when the promise is already rejected', () => {
    it('should reject it with the error', async () => {
      const p = wrapPromiseRejection(withTimeout(Promise.reject(myError), 0))
      await wait(1)
      expect(await p).toBe(myError)
    })
  })

  describe('when the promise is resolved before the timeout', () => {
    it('should return it', async () => {
      const p = wrapPromiseRejection(withTimeout(waitAndReturn(1, theResult), 30))
      await wait(30)
      expect(await p).toBe(theResult)
    })
  })

  describe('when the promise is resolved after the timeout', () => {
    it('should reject with a PromiseTimedOutError', async () => {
      const p = wrapPromiseRejection(withTimeout(waitAndReturn(30, theResult), 1))
      await wait(30)
      expect(await p).toBeInstanceOf(PromiseTimedOutError)
      expect(await p).toMatchObject({ message: 'Promise timed out after 1 ms' })
    })
  })

  describe('when the promise is rejected before the timeout', () => {
    it('should reject with the error', async () => {
      const p = wrapPromiseRejection(withTimeout(waitAndReject(1, myError), 30))
      await wait(30)
      expect(await p).toBe(myError)
    })
  })

  describe('when the promise is rejected after the timeout', () => {
    it('should reject with the PromiseTimedOutError', async () => {
      const p = wrapPromiseRejection(withTimeout(waitAndReject(30, myError), 1))
      await wait(30)
      expect(await p).toBeInstanceOf(PromiseTimedOutError)
      expect(await p).toMatchObject({ message: 'Promise timed out after 1 ms' })
    })
  })
})

describe('sleep', () => {
  let setTimeout: jest.SpyInstance
  beforeEach(() => {
    jest.clearAllMocks()
    setTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => (_.isFunction(cb) ? cb() : undefined))
  })
  afterAll(() => {
    jest.clearAllMocks()
  })

  it('should wait at least the specified time and not much more than it', async () => {
    await sleep(1000)
    expect(setTimeout).toHaveBeenCalledTimes(1)
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
  })
  it('should return immediately when delay is non-positive', async () => {
    await sleep(0)
    await sleep(-5)
    expect(setTimeout).not.toHaveBeenCalled()
  })
})
