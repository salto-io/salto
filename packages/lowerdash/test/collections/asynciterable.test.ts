/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { mockFunction } from '../multi_index.test'

const { asynciterable } = collections
const {
  findAsync, mapAsync, toArrayAsync, filterAsync, forEachAsync, toAsyncIterable, flatMapAsync,
  handleErrorsAsync,
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

  describe('flatMapAsync', () => {
    let iterable: AsyncIterable<number>
    beforeEach(() => {
      iterable = toAsyncIterable([1, 2, 3])
    })
    describe('when func is sync', () => {
      it('should return flat async iterable', async () => {
        const result = await toArrayAsync(
          flatMapAsync(iterable, num => [num, num])
        )
        expect(result).toEqual([1, 1, 2, 2, 3, 3])
      })
      it('should only flatten one level of iterable', async () => {
        const result = await toArrayAsync(
          flatMapAsync(iterable, num => [[num, num]])
        )
        expect(result).toEqual([[1, 1], [2, 2], [3, 3]])
      })
    })
    describe('when func is async', () => {
      it('should return flat async iterable', async () => {
        const result = await toArrayAsync(
          flatMapAsync(iterable, async num => [num, num])
        )
        expect(result).toEqual([1, 1, 2, 2, 3, 3])
      })
    })
    describe('when func returns async iterable', () => {
      it('should return flat async iterable', async () => {
        const result = await toArrayAsync(
          flatMapAsync(iterable, num => toAsyncIterable([num, num]))
        )
        expect(result).toEqual([1, 1, 2, 2, 3, 3])
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

  describe('forEachAsync', () => {
    it('should run the callback on all elements', async () => {
      let counter = 0
      const itr = toAsyncIterable(
        [1, 2, 3]
      )
      await forEachAsync(itr, async n => {
        counter += n
      })
      expect(counter).toEqual(6)
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
          mapAsync(
            toAsyncIterable([1, 2, 3, 4, 5]),
            num => (num === 4 ? Promise.reject(new Error('err')) : Promise.resolve(num))
          ),
          errorHandler
        ),
        mapper,
      )
    })
    describe('when error handling function throws', () => {
      let result: Promise<number[]>
      beforeEach(() => {
        errorHandler.mockImplementation(error => { throw error })
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
