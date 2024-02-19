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
import { mockFunction } from '@salto-io/test-utils'
import { collections } from '../../src'

const { asynciterable } = collections
const {
  handleErrorsAsync,
  findAsync,
  mapAsync,
  toArrayAsync,
  toAsyncIterable,
  concatAsync,
  filterAsync,
  flattenAsync,
  awu,
  isEmptyAsync,
  lengthAsync,
  peekAsync,
  takeAsync,
  zipSortedAsync,
  someAsync,
  everyAsync,
  forEachAsync,
  groupByAsync,
  keyByAsync,
  iterateTogether,
  flatMapAsync,
} = asynciterable
type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>

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
          expect(await findAsync(toAsyncIterable([1, 2, 3]), (v, i) => v === 3 && i === 2)).toBe(3)
        })
      })
      describe('when the predicate does not return true', () => {
        it('should return the value', async () => {
          expect(await findAsync(toAsyncIterable([1, 2, 3]), () => false)).toBeUndefined()
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
          expect(await findAsync(toAsyncIterable([1, 2, 3]), async (v, i) => v === 3 && i === 2)).toBe(3)
        })
      })
      describe('when the predicate does not return true', () => {
        it('should return the value', async () => {
          expect(await findAsync(toAsyncIterable([1, 2, 3]), async () => false)).toBeUndefined()
        })
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

  describe('isEmptyAsync', () => {
    it('should return true if the it is empty', async () => {
      expect(await isEmptyAsync(toAsyncIterable([]))).toBeTruthy()
    })

    it('should return false if the it is not empty', async () => {
      expect(await isEmptyAsync(toAsyncIterable([1]))).toBeFalsy()
    })
  })

  describe('lengthAsync', () => {
    it('should return the length of an array', async () => {
      expect(await lengthAsync(toAsyncIterable([1, 2, 3]))).toBe(3)
      expect(await lengthAsync(toAsyncIterable([]))).toBe(0)
      expect(await lengthAsync(toAsyncIterable([1]))).toBe(1)
      expect(await lengthAsync(toAsyncIterable([3, 2, 5, 7, 19, 80]))).toBe(6)
      expect(await awu([1, 2, 3]).length()).toBe(3)
    })
  })

  describe('peekAsync', () => {
    it('should return the first value in an it if its not empty', async () => {
      expect(await peekAsync(toAsyncIterable([1, 2, 3]))).toBe(1)
    })

    it('should return undefined if the it is empty', async () => {
      expect(await peekAsync(toAsyncIterable([]))).toBeUndefined()
    })
  })

  describe('takeAsync', () => {
    it('should return the first n values', async () => {
      expect(await toArrayAsync(takeAsync(toAsyncIterable(['A', 'B', 'C', 'D']), 2))).toEqual(['A', 'B'])
    })

    it('should return all of the itr elements if n is greated then the it size', async () => {
      expect(await toArrayAsync(takeAsync(['A', 'B'], 4))).toEqual(['A', 'B'])
    })

    it('should return nothing on an empty iterator', async () => {
      expect(await toArrayAsync(takeAsync([], 4))).toEqual([])
    })
  })

  describe('flatMapAsync', () => {
    let iterable: AsyncIterable<number>
    beforeEach(() => {
      iterable = toAsyncIterable([1, 2, 3])
    })
    describe('when func is sync', () => {
      it('should return flat async iterable', async () => {
        const result = await toArrayAsync(flatMapAsync(iterable, num => [num, num]))
        expect(result).toEqual([1, 1, 2, 2, 3, 3])
      })
      it('should only flatten one level of iterable', async () => {
        const result = await toArrayAsync(flatMapAsync(iterable, num => [[num, num]]))
        expect(result).toEqual([
          [1, 1],
          [2, 2],
          [3, 3],
        ])
      })
    })
    describe('when func is async', () => {
      it('should return flat async iterable', async () => {
        const result = await toArrayAsync(flatMapAsync(iterable, async num => [num, num]))
        expect(result).toEqual([1, 1, 2, 2, 3, 3])
      })
    })
    describe('when func returns async iterable', () => {
      it('should return flat async iterable', async () => {
        const result = await toArrayAsync(flatMapAsync(iterable, num => toAsyncIterable([num, num])))
        expect(result).toEqual([1, 1, 2, 2, 3, 3])
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
      asyncToStringMock = jest.fn().mockImplementation(async (v: number): Promise<string> => v.toString())
      numberIdentityMock = jest.fn().mockImplementation((v: number) => v)
    })

    describe('when mapFunc is sync', () => {
      describe('when given an empty iterable', () => {
        it('should return empty array', async () => {
          expect(await toArrayAsync(mapAsync(toAsyncIterable([]), toStringMock))).toEqual([])
          expect(toStringMock).toHaveBeenCalledTimes(0)
        })
      })

      describe('when iterable has values', () => {
        it('should return same result as a map on the original array', async () => {
          iterable = toAsyncIterable(baseArray)
          expect(await toArrayAsync(mapAsync(iterable, toStringMock))).toEqual(baseArray.map(v => v.toString()))
          expect(toStringMock).toHaveBeenCalledTimes(3)
        })
      })
    })
    describe('when mapFunc is async', () => {
      describe('when given an empty iterable', () => {
        it('should return empty array', async () => {
          expect(await toArrayAsync(mapAsync(toAsyncIterable([]), asyncToStringMock))).toEqual([])
          expect(asyncToStringMock).toHaveBeenCalledTimes(0)
        })
      })

      describe('when iterable has values', () => {
        it('should return same result as a map on an array (not Promises)', async () => {
          iterable = toAsyncIterable(baseArray)
          expect(await toArrayAsync(mapAsync(iterable, asyncToStringMock))).toEqual(baseArray.map(v => v.toString()))
          expect(asyncToStringMock).toHaveBeenCalledTimes(3)
        })
      })
    })

    describe('when mapFunc is called twice in a row', () => {
      it('should call both map funcs on each element before calling on the next one', async () => {
        iterable = toAsyncIterable(baseArray)
        expect(await toArrayAsync(mapAsync(mapAsync(iterable, numberIdentityMock), numberIdentityMock))).toEqual(
          baseArray,
        )
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
        expect(await toArrayAsync(filterAsync(iterable, i => i !== 2))).toEqual([1, 3])
      })
    })
    describe('when funcMap is async', () => {
      it('should return an async iterator without the filtered elements', async () => {
        const iterable = toAsyncIterable([1, 2, 3])
        expect(await toArrayAsync(filterAsync(iterable, async i => i !== 2))).toEqual([1, 3])
      })
    })
  })

  describe('concatAsync', () => {
    it('should return an empty iterator if one iterator is porivded', async () => {
      const concated = await toArrayAsync(concatAsync(toAsyncIterable([])))
      expect(concated).toEqual([])
    })
    it('should return the original iterator if only an iterator is provided', async () => {
      const concated = await toArrayAsync(concatAsync(toAsyncIterable([1, 2, 3])))
      expect(concated).toEqual([1, 2, 3])
    })
    it('should return an async version of the original iterator if only a sync iterator is provided', async () => {
      const concated = await toArrayAsync(concatAsync([1, 2, 3]))
      expect(concated).toEqual([1, 2, 3])
    })
    it('should concat multiple iterables', async () => {
      const concated = await toArrayAsync(
        concatAsync(toAsyncIterable([1, 2, 3]), [4, 5, 6], toAsyncIterable([7, 8, 9])),
      )
      expect(concated).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('flattenAsync', () => {
    it('should flatten all iterables', async () => {
      const flattened = await toArrayAsync(
        flattenAsync(
          [[1, 2, 3]],
          toAsyncIterable([[4], [5, 6]]),
          [toAsyncIterable([7, 8])],
          toAsyncIterable([[], toAsyncIterable([9])]),
          [10],
        ),
      )
      expect(flattened).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })
  })

  describe('zipSortedAsync', () => {
    it('should return a sorted iterable of multiple sorted iterables', async () => {
      const iterables = [toAsyncIterable([1, 4, 5, 12]), [3, 4, 6], [1, 2, 10], [], [40]]
      const shouldBeSorted = await toArrayAsync(zipSortedAsync(v => v, ...iterables))
      expect(shouldBeSorted).toEqual([1, 1, 2, 3, 4, 4, 5, 6, 10, 12, 40])
    })

    it('should throe an error if one of the iterables is unordered', async () => {
      const iterables = [
        [1, 4, 5, 12],
        [1, 3, 2],
      ]
      return expect(toArrayAsync(zipSortedAsync(v => v, ...iterables))).rejects.toThrow()
    })
  })

  describe('someAsync', () => {
    it('should return true of one of the elements is truthy', async () => {
      expect(await someAsync(toAsyncIterable([1, 2, 3, 4]), n => Promise.resolve(n === 2))).toBe(true)
    })
    it('should return false if none of the elements are truthy', async () => {
      expect(await someAsync(toAsyncIterable([1, 2, 3, 4]), n => Promise.resolve(n === 5))).toBe(false)
    })
    it('should allow some function to get an index', async () => {
      expect(await someAsync(toAsyncIterable([1, 2, 3, 4]), (n, i) => Promise.resolve(n === i))).toBe(false)
      expect(await someAsync(toAsyncIterable([1, 1, 3, 4]), (n, i) => Promise.resolve(n === i))).toBe(true)
    })
  })

  describe('everyAsync', () => {
    it('should return true of all of the elements is truthy', async () => {
      expect(await everyAsync(toAsyncIterable([1, 2, 3, 4]), n => Promise.resolve(n !== 5))).toBe(true)
    })
    it('should return false if at least one of the elements are falsy', async () => {
      expect(await everyAsync(toAsyncIterable([1, 2, 3, 4]), n => Promise.resolve(n !== 3))).toBe(false)
    })
  })

  describe('iterateTogether', () => {
    let firstIter: AsyncIterable<number>
    let secondIter: AsyncIterable<number>
    const cmp = (num1: number, num2: number): number => {
      if (num1 < num2) {
        return -1
      }
      if (num1 > num2) {
        return 1
      }
      return 0
    }
    beforeEach(() => {
      firstIter = awu([0, 1, 3, 4, 5, 8])
      secondIter = awu([0, 4, 5, 7, 9])
    })
    const expectBeforeAfterEquals = (array1: BeforeAfter<number>[], array2: BeforeAfter<number>[]): void => {
      expect(array1.length).toEqual(array2.length)
      for (let i = 0; i < array1.length; i += 1) {
        expect(array1[i].before).toEqual(array2[i].before)
        expect(array1[i].after).toEqual(array2[i].after)
      }
    }
    it('should order key-value pairs correctly', async () => {
      const result = await awu(iterateTogether(firstIter, secondIter, cmp)).toArray()
      const expected = [
        { before: 0, after: 0 },
        { before: 1, after: undefined },
        { before: 3, after: undefined },
        { before: 4, after: 4 },
        { before: 5, after: 5 },
        { before: undefined, after: 7 },
        { before: 8, after: undefined },
        { before: undefined, after: 9 },
      ]
      expectBeforeAfterEquals(result, expected)
      const resultReversed = await awu(iterateTogether(secondIter, firstIter, cmp)).toArray()
      expectBeforeAfterEquals(
        resultReversed,
        expected.map(ba => ({ before: ba.after, after: ba.before })),
      )
    })
    it('should throw exception if iterator unsorted', async () => {
      await expect(awu(iterateTogether(awu(firstIter), awu([1, 0]), cmp)).toArray()).rejects.toEqual(
        new Error('Runtime Error: iterators must be sorted'),
      )
      await expect(awu(iterateTogether(awu([0, 5, 1]), secondIter, cmp)).toArray()).rejects.toEqual(
        new Error('Runtime Error: iterators must be sorted'),
      )
    })
  })

  describe('forEachAsync', () => {
    it('should run the callback on all elements', async () => {
      let counter = 0
      const itr = toAsyncIterable([1, 2, 3])
      await forEachAsync(itr, async n => {
        counter += n
      })
      expect(counter).toEqual(6)
    })
  })

  describe('groupByAsync', () => {
    it('should group according to key function', async () => {
      const itr = toAsyncIterable([1, 2, 3, 4])
      const res = await groupByAsync(itr, async v => (v % 2 === 0 ? 'even' : 'odd'))
      expect(res).toEqual({
        odd: [1, 3],
        even: [2, 4],
      })
    })
  })

  describe('keyByAsync', () => {
    it('should create a key according to the key function', async () => {
      const itr = toAsyncIterable([
        { key: 'A', val: 1 },
        { key: 'B', val: 1 },
      ])
      const res = await keyByAsync(itr, async v => v.key)
      expect(res).toEqual({
        A: { key: 'A', val: 1 },
        B: { key: 'B', val: 1 },
      })
    })
  })

  describe('async wrapper', () => {
    const baseIt = (): AsyncIterable<number> => toAsyncIterable([1, 2, 3])
    describe('wrap an non-async iterable', () => {
      it('should work, just like a normal ietrable wrap', async () => {
        const iter = [1, 2, 3]
        expect(await toArrayAsync(awu(iter))).toEqual(iter)
      })
    })
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
      it('should forward the forEach function to forEachAsync', async () => {
        let counter = 0
        await awu(toAsyncIterable([1, 2, 3])).forEach(n => {
          counter += n
        })
        expect(counter).toEqual(6)
      })
      it('should forward the isEmpty function to isEmptyAsync', async () => {
        expect(await awu([]).isEmpty()).toBe(true)
      })
      it('should forward the peek function to peekAsync', async () => {
        expect(await awu([1, 2, 3]).peek()).toBe(1)
      })
      it('should forward the take function to takeAsync', async () => {
        expect(await awu([1, 2, 3]).take(2).toArray()).toEqual([1, 2])
      })
      it('should forward the flat function to flatAsync', async () => {
        expect(
          await awu([[1, 2], [3]])
            .flat()
            .toArray(),
        ).toEqual([1, 2, 3])
      })
      it('should forward the some function to someAsync', async () => {
        expect(await awu([true, false]).some(i => i)).toBeTruthy()
      })
      it('should forward the every function to everyAsync', async () => {
        expect(await awu([true, false]).every(i => i)).toBeFalsy()
      })
      it('should forward the keyBy function to keyByAsync', async () => {
        expect(await awu([{ key: 'A' }]).keyBy(o => o.key)).toEqual({
          A: { key: 'A' },
        })
      })
      it('should forward the groupBy function to groupByAsync', async () => {
        expect(await awu([{ key: 'A' }]).groupBy(o => o.key)).toEqual({
          A: [{ key: 'A' }],
        })
      })
      it('should delete copies from list when uniquifying', async () => {
        expect(
          await awu([1, 2, 3, 5, 4, 6, 6, 4, 3, 7, 2, 1])
            .uniquify(num => num)
            .toArray(),
        ).toEqual([1, 2, 3, 5, 4, 6, 7])
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

    describe('reduce', () => {
      it('should return the reduced value', async () => {
        const res = await awu([1, 2, 3]).reduce(async (total, current, index) => total + current + index, 0)
        expect(res).toEqual(9)
      })
    })
  })

  describe('handleErrorsAsync', () => {
    let iterable: AsyncIterable<number>
    let errorHandler: jest.MockedFunction<Parameters<typeof handleErrorsAsync>[1]>
    let mapper: jest.MockedFunction<(num: number) => number>
    beforeEach(() => {
      errorHandler = mockFunction<typeof errorHandler>()
      mapper = mockFunction<typeof mapper>().mockImplementation(num => num)
      iterable = mapAsync(
        handleErrorsAsync(
          mapAsync(toAsyncIterable([1, 2, 3, 4, 5]), num =>
            num === 4 ? Promise.reject(new Error('err')) : Promise.resolve(num),
          ),
          errorHandler,
        ),
        mapper,
      )
    })
    describe('when error handling function throws', () => {
      let result: Promise<number[]>
      beforeEach(() => {
        errorHandler.mockImplementation(error => {
          throw error
        })
        result = toArrayAsync(iterable)
      })
      it('should throw the error', async () => {
        await expect(result).rejects.toThrow()
      })
      it('should call error handler with the error', async () => {
        await result.catch(() => undefined) // wait for iterable to finish
        expect(errorHandler).toHaveBeenCalledWith(new Error('err'))
      })
      it('should stop iteration after the error', async () => {
        await result.catch(() => undefined) // wait for iterable to finish
        expect(mapper).toHaveBeenCalledTimes(3)
      })
    })
    describe('when error handling function does not throw', () => {
      let result: Promise<number[]>
      beforeEach(() => {
        result = toArrayAsync(iterable)
      })
      it('should stop iteration after the error', async () => {
        await result // wait for iterable to finish
        expect(mapper).toHaveBeenCalledTimes(3)
        expect(mapper).not.toHaveBeenCalledWith(5)
      })
      it('should suppress the error', async () => {
        await expect(result).resolves.toEqual([1, 2, 3])
      })
    })
  })
})
