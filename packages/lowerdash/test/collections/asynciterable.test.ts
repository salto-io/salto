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
const {
  findAsync, mapAsync, toArrayAsync, toAsyncIterable, concatAsync,
  filterAsync, flattenAsync, awu,
} = asynciterable

describe('asynciterable', () => {
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

  describe('filterAsync', () => {
    describe('when funcMap is sync', () => {
      it('should return an async iterator without the filtered elements', async () => {
        const iterable = toAsyncIterable([1, 2, 3])
        expect(await toArrayAsync(
          filterAsync(iterable, i => i !== 2)
        )).toEqual([1, 3])
      })
    })
    describe('when funcMap is async', () => {
      it('should return an async iterator without the filtered elements', async () => {
        const iterable = toAsyncIterable([1, 2, 3])
        expect(await toArrayAsync(
          filterAsync(iterable, async i => i !== 2)
        )).toEqual([1, 3])
      })
    })
  })

  describe('concatAsync', () => {
    it('should return an empty iterator if one iterator is porivded', async () => {
      const concated = await toArrayAsync(concatAsync(
        toAsyncIterable([])
      ))
      expect(concated).toEqual([])
    })
    it('should return the original iterator if only an iterator is provided', async () => {
      const concated = await toArrayAsync(concatAsync(
        toAsyncIterable([1, 2, 3])
      ))
      expect(concated).toEqual([1, 2, 3])
    })
    it('should return an async version of the original iterator if only a sync iterator is provided', async () => {
      const concated = await toArrayAsync(concatAsync(
        [1, 2, 3]
      ))
      expect(concated).toEqual([1, 2, 3])
    })
    it('should concat multiple iterables', async () => {
      const concated = await toArrayAsync(concatAsync(
        toAsyncIterable([1, 2, 3]),
        [4, 5, 6],
        toAsyncIterable([7, 8, 9])
      ))
      expect(concated).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('flattenAsync', () => {
    it('should flatten all iterables', async () => {
      const flattened = await toArrayAsync(flattenAsync(
        [[1, 2, 3]],
        toAsyncIterable([[4], [5, 6]]),
        [toAsyncIterable([7, 8])],
        toAsyncIterable([[], toAsyncIterable([9])]),
      ))
      expect(flattened).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('async wrapper', () => {
    const baseIt = (): AsyncIterable<number> => toAsyncIterable([1, 2, 3])

    describe('maintain original iterable functionality', () => {
      it('should return the same values as the original iterator when no function was invoked', async () => {
        expect(await toArrayAsync(awu(baseIt()))).toEqual([1, 2, 3])
      })
    })
    describe('async iterable functions', () => {
      it('should forward the map function to asyncMap', async () => {
        const mapped = awu(baseIt()).map(async i => i * 2)
        expect(await toArrayAsync(mapped)).toEqual([2, 4, 6])
      })
      it('should forward the find function to asyncFind', async () => {
        expect(await awu(baseIt()).find(i => i > 1)).toEqual(2)
      })
      it('should forward the filter function to asyncFilter', async () => {
        const filtered = awu(baseIt()).filter(async i => i !== 2)
        expect(await toArrayAsync(filtered)).toEqual([1, 3])
      })
      it('should forward the concat function to asyncConcat', async () => {
        const concated = awu(baseIt()).concat(toAsyncIterable([4, 5, 6]))
        expect(await toArrayAsync(concated)).toEqual([1, 2, 3, 4, 5, 6])
      })
      it('should forward the flatMap function to asyncFlatten', async () => {
        const complex = awu(toAsyncIterable([1, 2, 3])).flatMap(i => [i, i])
        expect(await toArrayAsync(complex)).toEqual([1, 1, 2, 2, 3, 3])
      })
      it('should forward the toArray function to asyncToArray', async () => {
        expect(await awu(toAsyncIterable([1, 2, 3])).toArray()).toEqual([1, 2, 3])
      })
    })
    describe('function chaining', () => {
      describe('when orig is async', () => {
        it('should chain functions', async () => {
          const res = await awu(baseIt())
            .flatMap(i => [i, i * 2])
            .concat(baseIt())
            .filter(i => i > 3)
            .toArray()
          expect(res).toEqual([4, 6])
        })
      })
      describe('when orig is sync', () => {
        it('should chain functions', async () => {
          const res = await awu([1, 2, 3])
            .flatMap(i => [i, i * 2])
            .concat(baseIt())
            .filter(i => i > 3)
            .toArray()
          expect(res).toEqual([4, 6])
        })
      })
    })
  })
})
