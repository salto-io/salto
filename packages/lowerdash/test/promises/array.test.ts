/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { partition, removeAsync, series, withLimitedConcurrency } from '../../src/promises/array'
import { arrayOf } from '../../src/collections/array'
import { MaxCounter, maxCounter } from '../max_counter'

describe('array', () => {
  describe('series and withLimitedConcurrency', () => {
    const resolveTimes = [2, 3, 1, 4, 0]
    const NUM_PROMISES = resolveTimes.length
    let input: (() => Promise<number>)[]
    let output: number[]
    let concurrencyCounter: MaxCounter

    beforeEach(() => {
      concurrencyCounter = maxCounter()
      input = arrayOf(
        NUM_PROMISES,
        i => () =>
          new Promise<number>(resolve => {
            concurrencyCounter.increment()
            setTimeout(() => {
              resolve(i)
              concurrencyCounter.decrement()
            }, resolveTimes[i])
          }),
      )
    })

    describe('series', () => {
      beforeEach(async () => {
        output = await series(input)
      })

      it('resolves all promises', async () => {
        expect(output).toEqual(arrayOf(NUM_PROMISES, i => i))
      })

      it('creates all promises in series', async () => {
        expect(concurrencyCounter.max).toBe(1)
      })
    })

    describe('counter example: Promise.all', () => {
      beforeEach(async () => {
        output = await Promise.all(input.map(f => f()))
      })

      it('creates all promises in parallel', async () => {
        expect(concurrencyCounter.max).toBe(NUM_PROMISES)
      })
    })

    describe('withLimitedConcurrency', () => {
      const MAX_CONCURRENCY = 2

      beforeEach(async () => {
        output = await withLimitedConcurrency(input, MAX_CONCURRENCY)
      })

      it('resolves all promises', async () => {
        expect(output).toEqual(arrayOf(NUM_PROMISES, i => i))
      })

      it('creates all promises with the specified maxConcurrency', async () => {
        expect(concurrencyCounter.max).toBe(MAX_CONCURRENCY)
      })
    })
  })

  describe('partition', () => {
    const predicate = async (v: number): Promise<boolean> => v % 2 === 0

    describe('when given an empty input iterable', () => {
      it('returns an empty result', async () => {
        expect(await partition<number>([], predicate)).toEqual([[], []])
      })
    })

    describe('when given a non-empty input iterable', () => {
      it('returns a correct result', async () => {
        expect(await partition([1, 2, 3, 4], predicate)).toEqual([
          [2, 4],
          [1, 3],
        ])
      })
    })
  })

  describe('removeAsync', () => {
    const predicate = async (v: number): Promise<boolean> => v % 2 === 0

    describe('when given an empty input iterable', () => {
      it('returns an empty result', async () => {
        expect(await removeAsync<number>([], predicate)).toEqual([])
      })
    })

    describe('when given a non-empty input iterable', () => {
      it('returns a correct result', async () => {
        const arr = [1, 2, 3, 4]
        await removeAsync(arr, predicate)
        expect(arr).toEqual([1, 3])
      })
    })
  })
})
