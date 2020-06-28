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
import { collections } from '../../src'

const { asynciterable } = collections

describe('asynciterable', () => {
  const { findAsync } = asynciterable

  const toAsyncIterable = <T>(i: Iterable<T>): AsyncIterable<T> => {
    const iter = i[Symbol.iterator]()
    return {
      [Symbol.asyncIterator]: (): AsyncIterator<T> => ({
        next: async () => iter.next(),
      }),
    }
  }

  describe('findAsync', () => {
    describe('when given a sync pred', () => {
      describe('when given an empty iterable', () => {
        it('should return undefined', async () => {
          expect(await findAsync(toAsyncIterable([]), () => true)).toBeUndefined()
        })
      })
      describe('when the predicate returns true', () => {
        it('should return the value', async () => {
          expect(await findAsync(
            toAsyncIterable([1, 2, 3]),
            (v, i) => v === 3 && i === 2,
          )).toBe(3)
        })
      })
      describe('when the predicate does not return true', () => {
        it('should return the value', async () => {
          expect(await findAsync(toAsyncIterable([1, 2, 3]), () => false)).toBeUndefined()
        })
      })
    })
  })

  describe('when given an async pred', () => {
    describe('when given an empty iterable', () => {
      it('should return undefined', async () => {
        expect(await findAsync(toAsyncIterable([]), async () => true)).toBeUndefined()
      })
    })
    describe('when the predicate returns true', () => {
      it('should return the value', async () => {
        expect(await findAsync(
          toAsyncIterable([1, 2, 3]),
          async (v, i) => v === 3 && i === 2,
        )).toBe(3)
      })
    })
    describe('when the predicate does not return true', () => {
      it('should return the value', async () => {
        expect(await findAsync(toAsyncIterable([1, 2, 3]), async () => false)).toBeUndefined()
      })
    })
  })
})
