/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import wu from 'wu'
import { SetId } from './set'
import { DefaultMap } from './map'

export const groupBy = <K extends SetId, V>(elements: Iterable<V>, groupFunc: (t: V) => K): Map<K, V[]> =>
  new Map(
    wu(elements).reduce(
      (groupMap, elem) => {
        groupMap.get(groupFunc(elem)).push(elem)
        return groupMap
      },
      new DefaultMap<K, V[]>(() => []),
    ),
  )

export type Indexed<T> = [number, T]
export type IndexedIterator<T> = Iterator<Indexed<T>>
export type IndexedIterable<T> = Iterable<Indexed<T>>

export const toIndexedIterable = <T>(iterable: Iterable<T>): IndexedIterable<T> => {
  let index = -1

  const convert = (r: IteratorResult<T>): IteratorResult<Indexed<T>> => {
    if (r.done) {
      return r
    }
    index += 1
    return { done: r.done, value: [index, r.value as T] }
  }

  const iterator = iterable[Symbol.iterator]()
  const { return: originalReturn, throw: originalThrow } = iterator

  return {
    [Symbol.iterator]: (): IndexedIterator<T> => ({
      next: () => convert(iterator.next()),
      return: originalReturn ? value => convert(originalReturn.bind(iterator)(value)) : undefined,
      throw: originalThrow ? value => convert(originalThrow.bind(iterator)(value)) : undefined,
    }),
  }
}
