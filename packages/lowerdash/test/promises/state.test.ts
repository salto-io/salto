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
import { promiseWithState, PromiseWithState } from '../../src/promises/state'

describe('promiseWithState', () => {
  let o: Promise<number>
  let p: PromiseWithState<number>

  describe('when the promise is not resolved or rejected', () => {
    beforeEach(() => {
      o = new Promise<number>(() => undefined)
      p = promiseWithState(o)
    })

    it('is not done', () => {
      expect(p.done).toBe(false)
    })

    it('is not resolved', () => {
      expect(p.resolved).toBe(false)
    })

    it('is not rejected', () => {
      expect(p.rejected).toBe(false)
    })
  })

  describe('when the promise is resolved', () => {
    beforeEach(() => {
      o = Promise.resolve(42)
      p = promiseWithState(o)
    })

    it('is done', () => {
      expect(p.done).toBe(true)
    })

    it('is resolved', () => {
      expect(p.resolved).toBe(true)
    })

    it('is resolved with the original value', () => expect(p).resolves.toBe(42))

    it('is not rejected', () => expect(p.rejected).toBe(false))
  })

  describe('when the promise is rejected', () => {
    let e: '42'

    beforeEach(() => {
      o = Promise.reject(new Error(e))
      p = promiseWithState(o)
    })

    afterEach(() => expect(p).rejects.toThrow()) // prevent UnhandledPromiseRejectionWarning

    it('is done', () => {
      expect(p.done).toBe(true)
    })

    it('is not resolved', () => {
      expect(p.resolved).toBe(false)
    })

    it('is rejected', () => {
      expect(p.rejected).toBe(true)
    })

    it('is rejected with the original reason', () => expect(p).rejects.toThrow(e))
  })

  describe('when called with an already wrapped instance', () => {
    let p2: PromiseWithState<number>
    beforeEach(() => {
      p = promiseWithState(Promise.resolve(42))
      p2 = promiseWithState(p)
    })

    it('does not wrap again', () => {
      expect(p2).toBe(p)
    })
  })
})
