/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { arrayOf } from '../collections/array'
import { toIndexedIterable, IndexedIterator } from '../collections/iterable'

export const partition = async <T>(
  iterable: Iterable<T>,
  partitioner: (item: T) => Promise<boolean>,
): Promise<[T[], T[]]> => {
  const i = iterable[Symbol.iterator]()
  const truthfull: T[] = []
  const nonThruthfull: T[] = []
  const next = async (): Promise<[T[], T[]]> => {
    const { done, value } = i.next()
    if (done) {
      return [truthfull, nonThruthfull]
    }
    const resultArr = (await partitioner(value)) ? truthfull : nonThruthfull
    resultArr.push(value)
    return next()
  }

  return next()
}

const seriesImpl = <T>(iterator: IndexedIterator<() => Promise<T>>, results: T[]): Promise<T[]> => {
  const next = async (): Promise<T[]> => {
    const { done, value: indexedValue } = iterator.next()
    if (done) {
      return results
    }
    const [index, valuePromise] = indexedValue
    results[index] = await valuePromise()
    return next()
  }
  return next()
}

export const series = async <T>(promises: Iterable<() => Promise<T>>): Promise<T[]> =>
  seriesImpl(toIndexedIterable(promises)[Symbol.iterator](), [])

export const withLimitedConcurrency = async <T>(
  promises: Iterable<() => Promise<T>>,
  maxConcurrency: number,
): Promise<T[]> => {
  const i = toIndexedIterable(promises)[Symbol.iterator]()
  const results: T[] = []
  await Promise.all(arrayOf(maxConcurrency, () => seriesImpl(i, results)))
  return results
}

export const removeAsync = async <T>(arr: T[], removeFunc: (t: T) => Promise<boolean> | boolean): Promise<T[]> => {
  const idxToRemove = new Set()
  for (const val of arr) {
    // eslint-disable-next-line no-await-in-loop
    if (await removeFunc(val)) {
      idxToRemove.add(val)
    }
  }
  return _.remove(arr, v => idxToRemove.has(v))
}
