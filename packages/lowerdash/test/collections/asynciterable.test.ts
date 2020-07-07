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
const { findAsync, mapAsync, toArrayAsync } = asynciterable

describe('asynciterable', () => {
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

  describe('toArrayAsync', () => {
    describe('when given an empty iterable', () => {
      it('should return an empty array', async () => {
        expect(await toArrayAsync(toAsyncIterable([]))).toEqual([])
      })
    })
    describe('when iterable has values', () => {
      it('should return the array values', async () => {
        const array = [1, 2, 3, 4, 5]
        expect(await toArrayAsync(toAsyncIterable(array))).toEqual(array)
      })
    })
  })

  describe('mapAsync', () => {
    let toStringMock: jest.Mock
    let asyncToStringMock: jest.Mock
    let numberIdentityMock: jest.Mock
    let iterable: AsyncIterable<number>
    const baseArray = [1, 2, 3]

    beforeEach(() => {
      toStringMock = jest.fn().mockImplementation((v: number) => v.toString())
      asyncToStringMock = jest.fn().mockImplementation(async (v: number): Promise<string> =>
        v.toString())
      numberIdentityMock = jest.fn().mockImplementation((v: number) => v)
    })

    describe('when mapFunc is sync', () => {
      describe('when given an empty iterable', () => {
        it('should return empty array', async () => {
          expect(await toArrayAsync(
            await mapAsync(toAsyncIterable([]), toStringMock)
          )).toEqual([])
          expect(toStringMock).toHaveBeenCalledTimes(0)
        })
      })

      describe('when iterable has values', () => {
        it('should return same result as a map on the original array', async () => {
          iterable = toAsyncIterable(baseArray)
          expect(await toArrayAsync(
            await mapAsync(iterable, toStringMock)
          )).toEqual(baseArray.map(v => v.toString()))
          expect(toStringMock).toHaveBeenCalledTimes(3)
        })
      })
    })
    describe('when mapFunc is async', () => {
      describe('when given an empty iterable', () => {
        it('should return empty array', async () => {
          expect(await toArrayAsync(
            await mapAsync(toAsyncIterable([]), asyncToStringMock)
          )).toEqual([])
          expect(asyncToStringMock).toHaveBeenCalledTimes(0)
        })
      })

      describe('when iterable has values', () => {
        it('should return same result as a map on an array (not Promises)', async () => {
          iterable = toAsyncIterable(baseArray)
          expect(await toArrayAsync(
            await mapAsync(iterable, asyncToStringMock)
          )).toEqual(baseArray.map(v => v.toString()))
          expect(asyncToStringMock).toHaveBeenCalledTimes(3)
        })
      })
    })

    describe('when mapFunc is called twice in a row', () => {
      it('should call both map funcs on each element before calling on the next one', async () => {
        iterable = toAsyncIterable(baseArray)
        expect(await toArrayAsync(
          await mapAsync(await mapAsync(iterable, numberIdentityMock), numberIdentityMock)
        )).toEqual(baseArray)
        expect(numberIdentityMock).toHaveBeenCalledTimes(6)
        expect(numberIdentityMock).toHaveBeenNthCalledWith(1, 1, 0)
        expect(numberIdentityMock).toHaveBeenNthCalledWith(2, 1, 0)
        expect(numberIdentityMock).toHaveBeenNthCalledWith(3, 2, 1)
        expect(numberIdentityMock).toHaveBeenNthCalledWith(4, 2, 1)
        expect(numberIdentityMock).toHaveBeenNthCalledWith(5, 3, 2)
        expect(numberIdentityMock).toHaveBeenNthCalledWith(6, 3, 2)
      })
    })
  })
})
