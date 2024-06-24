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
