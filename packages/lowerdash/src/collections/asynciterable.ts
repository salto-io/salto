/*
*                      Copyright 2023 Salto Labs Ltd.
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

import _ from 'lodash'
import * as values from '../values'

type Thenable<T> = T | Promise<T>
export type ThenableIterable<T> = Iterable<T> | AsyncIterable<T>

const isAsyncIterable = <T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itr: any
): itr is AsyncIterable<T> => itr[Symbol.asyncIterator] !== undefined

const isIterable = <T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itr: any
): itr is Iterable<T> => itr[Symbol.iterator] !== undefined

export const findAsync = async <T>(
  i: ThenableIterable<T>,
  pred: (value: T, index: number) => Thenable<unknown>,
): Promise<T | undefined> => {
  let index = 0
  for await (const v of i) {
    if (await pred(v, index)) {
      return v
    }
    index += 1
  }
  return undefined
}

export async function *mapAsync<T, U>(
  itr: ThenableIterable<T>,
  mapFunc: (t: T, index: number) => Thenable<U>,
): AsyncIterable<U> {
  let index = 0
  for await (const curr of itr) {
    yield mapFunc(curr, index)
    index += 1
  }
}

export async function *flatMapAsync<T, U>(
  itr: AsyncIterable<T>,
  mapFunc: (t: T, index: number) => Iterable<U> | AsyncIterable<U> | Promise<Iterable<U>>
): AsyncIterable<U> {
  let index = 0
  for await (const curr of itr) {
    const res = await mapFunc(curr, index)
    index += 1
    for await (const nextRes of res) {
      yield nextRes
    }
  }
}

export const forEachAsync = async <T>(
  itr: ThenableIterable<T>,
  mapFunc: (t: T, index: number) => Thenable<unknown>,
): Promise<void> => {
  let index = 0
  for await (const curr of itr) {
    await mapFunc(curr, index)
    index += 1
  }
}

export async function *toAsyncIterable<T>(iterable: Iterable<T>): AsyncIterable<T> {
  for (const item of iterable) {
    yield item
  }
}

export const toArrayAsync = async <T>(
  iterable: ThenableIterable<T>,
): Promise<Array<T>> => {
  const res: T[] = []
  for await (const curr of iterable) {
    res.push(curr)
  }
  return res
}

export async function *concatAsync<T>(
  ...iterables: ThenableIterable<T>[]
): AsyncIterable<T> {
  for (const itr of iterables) {
    // eslint-disable-next-line no-await-in-loop
    for await (const item of itr) {
      yield item
    }
  }
}
export function filterAsync<T, S extends T>(
  itr: ThenableIterable<T>,
  filterFunc: (t: T, index: number) => t is S
): AsyncIterable<S>
export function filterAsync<T>(
  itr: ThenableIterable<T>,
  filterFunc: (t: T, index: number) => Thenable<boolean>
): AsyncIterable<T>
export async function *filterAsync<T>(
  itr: ThenableIterable<T>,
  filterFunc: (t: T, index: number) => unknown
): AsyncIterable<T> {
  let index = 0
  for await (const item of itr) {
    if (await filterFunc(item, index)) {
      yield item
    }
    index += 1
  }
}

export const handleErrorsAsync = <T>(
  itr: AsyncIterable<T>,
  onError: (error: Error) => void,
): AsyncIterable<T> => ({
    [Symbol.asyncIterator]: () => {
      const it = itr[Symbol.asyncIterator]()
      return {
        next: async args => {
          try {
            return await it.next(args)
          } catch (error) {
            onError(error as Error)
            return { done: true, value: undefined }
          }
        },
      }
    },
  })

export async function *flattenAsync<T>(
  ...iterables: ThenableIterable<ThenableIterable<T> | T>[]
): AsyncIterable<T> {
  for (const itr of iterables) {
    // eslint-disable-next-line no-await-in-loop
    for await (const nestedItr of itr) {
      if (isAsyncIterable(nestedItr) || isIterable(nestedItr)) {
        for await (const item of nestedItr) {
          yield item
        }
      } else {
        yield nestedItr
      }
    }
  }
}

export const lengthAsync = async <T>(itr: ThenableIterable<T>): Promise<number> => {
  let len = 0
  await forEachAsync(itr, async _item => {
    len += 1
  })
  return len
}

export const peekAsync = async <T>(itr: ThenableIterable<T>): Promise<T | undefined> => {
  for await (const item of itr) {
    return item
  }
  return undefined
}

export const isEmptyAsync = async <T>(
  itr: ThenableIterable<T>
): Promise<boolean> => (await peekAsync(itr)) === undefined

export async function *takeAsync<T>(
  itr: ThenableIterable<T>,
  maxItems: number
): AsyncIterable<T> {
  let counter = 0
  const it = isAsyncIterable(itr) ? itr[Symbol.asyncIterator]() : itr[Symbol.iterator]()
  let item: IteratorResult<T>
  // eslint-disable-next-line
  while (!(item = await it.next()).done && counter < maxItems) {
    yield item.value
    counter += 1
  }
}

export async function *zipSortedAsync<T, V>(
  keyBy: (value: T) => V,
  ...iterables: ThenableIterable<T>[]
): AsyncIterable<T> {
  let item: T | undefined
  const itrs = iterables.map(itr => (isAsyncIterable(itr)
    ? itr[Symbol.asyncIterator]()
    : itr[Symbol.iterator]()
  ))

  const popItem = async (itr: AsyncIterator<T> | Iterator<T>): Promise<T | undefined> => {
    const res = await itr.next()
    if (res.done) {
      return undefined
    }
    return res.value
  }
  const poppedItems = await toArrayAsync(mapAsync(itrs, itr => popItem(itr)))

  const popLowestItem = async (): Promise<T | undefined> => {
    const minValue = _.minBy(poppedItems.filter(values.isDefined), keyBy)
    const minIndex = poppedItems.findIndex(
      v => values.isDefined(v) && minValue && keyBy(v) === keyBy(minValue)
    )
    if (!values.isDefined(minValue) || !values.isDefined(minIndex)) {
      return undefined
    }
    if (item !== undefined && keyBy(minValue) < keyBy(item)) {
      throw new Error(`Can not zip unsorted iterables. ${keyBy(minValue)} is greater than ${keyBy(item)}`)
    }
    const nextItem = await popItem(itrs[minIndex])
    poppedItems[minIndex] = nextItem
    return minValue
  }
  // eslint-disable-next-line
  while ((item = await popLowestItem()) !== undefined) {
    yield item
  }
}

export const groupByAsync = async <T>(
  itr: ThenableIterable<T>,
  groupFunc: (t: T) => Thenable<string>
): Promise<Record<string, T[]>> => {
  const res: Record<string, T[]> = {}
  for await (const t of itr) {
    const key = await groupFunc(t)
    res[key] = res[key] || []
    res[key].push(t)
  }
  return res
}

export const keyByAsync = async<T>(
  itr: ThenableIterable<T>,
  keyFunc: (t: T) => Thenable<string>
): Promise<Record<string, T>> => Object.fromEntries(
  await toArrayAsync(mapAsync(itr, async t => [await keyFunc(t), t]))
)

export const someAsync = async<T>(
  itr: ThenableIterable<T>,
  func: (t: T, i: number) => Thenable<unknown>
): Promise<boolean> => await findAsync(mapAsync(itr, func), res => res) !== undefined

export const everyAsync = async<T>(
  itr: ThenableIterable<T>,
  func: (t: T) => Thenable<unknown>
): Promise<boolean> => !(await someAsync(itr, async t => !(await func(t))))

export const reduceAsync = async <T, U>(
  itr: ThenableIterable<T>,
  reduceFunc: (total: U, currentValue: T, index: number) => Thenable<U>,
  initialValue: U,
): Promise<U> => {
  let index = 0
  let last = initialValue
  for await (const curr of itr) {
    last = await reduceFunc(last, curr, index)
    index += 1
  }
  return last
}

export type BeforeAfter<T> = {
  before: T | undefined
  after: T | undefined
}

export async function *iterateTogether<T>(before: AsyncIterable<T>,
  after: AsyncIterable<T>, cmp: (obj1: T, obj2: T) => number): AsyncIterable<BeforeAfter<T>> {
  const beforeIterator = before[Symbol.asyncIterator]()
  const afterIterator = after[Symbol.asyncIterator]()
  const nextDefinedValue = async (
    iter: AsyncIterator<T>,
    curValue: T | undefined = undefined,
  ): Promise<T | undefined> => {
    const next = await iter.next()
    if (next.done) {
      return undefined
    }
    if (curValue && cmp(curValue, next.value) > -1) {
      throw new Error('Runtime Error: iterators must be sorted')
    }
    return next.value
  }
  let currentBefore = await nextDefinedValue(beforeIterator)
  let currentAfter = await nextDefinedValue(afterIterator)
  while (!(currentBefore === undefined && currentAfter === undefined)) {
    if (currentBefore === undefined) {
      yield { before: undefined, after: currentAfter }
      // eslint-disable-next-line no-await-in-loop
      currentAfter = await nextDefinedValue(afterIterator, currentAfter)
    } else if (currentAfter === undefined) {
      yield { before: currentBefore, after: undefined }
      // eslint-disable-next-line no-await-in-loop
      currentBefore = await nextDefinedValue(beforeIterator, currentBefore)
    } else if (cmp(currentBefore, currentAfter) < 0) {
      yield { before: currentBefore, after: undefined }
      // eslint-disable-next-line no-await-in-loop
      currentBefore = await nextDefinedValue(beforeIterator, currentBefore)
    } else if (cmp(currentBefore, currentAfter) > 0) {
      yield { before: undefined, after: currentAfter }
      // eslint-disable-next-line no-await-in-loop
      currentAfter = await nextDefinedValue(afterIterator, currentAfter)
    } else {
      yield { before: currentBefore, after: currentAfter }
      // eslint-disable-next-line no-await-in-loop
      currentAfter = await nextDefinedValue(afterIterator, currentAfter)
      // eslint-disable-next-line no-await-in-loop
      currentBefore = await nextDefinedValue(beforeIterator, currentBefore)
    }
  }
}

const uniquify = <T, K>(vals: ThenableIterable<T>, toSetType: (val: T) => K): AsyncIterable<T> => {
  const uniques = new Set<K>()
  return filterAsync(vals, val => {
    if (uniques.has(toSetType(val))) {
      return false
    }
    uniques.add(toSetType(val))
    return true
  })
}

export type AwuIterable<T> = AsyncIterable<T> & {
  filter<S extends T>(filterFunc: (t: T, index: number) => t is S): AwuIterable<S>
  filter(filterFunc: (t: T, index: number) => Thenable<boolean>): AwuIterable<T>
  concat(...iterables: ThenableIterable<T>[]): AwuIterable<T>
  toArray(): Promise<Array<T>>
  map<U>(mapFunc: (t: T, index: number) => Thenable<U>): AwuIterable<U>
  find(pred: (value: T, index: number) => Thenable<boolean>): Promise<T | undefined>
  flatMap<U>(mapFunc: (t: T, index: number) => Thenable<ThenableIterable<U>>): AwuIterable<U>
  forEach(mapFunc: (t: T, index: number) => Thenable<unknown>): Promise<void>
  isEmpty(): Promise<boolean>
  peek(): Promise<T | undefined>
  length(): Promise<number>
  take(maxItems: number): AwuIterable<T>
  // This is the way wu handles the flat function types as well...
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flat(): AwuIterable<any>
  some(func: (t: T, i: number) => Thenable<unknown>): Promise<boolean>
  every(func: (t: T) => Thenable<unknown>): Promise<boolean>
  keyBy(keyFunc: (t: T) => Thenable<string>): Promise<Record<string, T>>
  groupBy(keyFunc: (t: T) => Thenable<string>): Promise<Record<string, T[]>>
  uniquify(toSetType: (t: T) => unknown): AwuIterable<T>
  reduce<U>(
    reduceFunc: (total: U, currentValue: T, index: number) => Thenable<U>,
    initialValue: U
  ): Promise<U>
}

export const awu = <T>(itr: ThenableIterable<T>): AwuIterable<T> => {
  function awuFilter<S extends T>(filterFunc: (t: T, index: number) => t is S): AwuIterable<S>
  function awuFilter(filterFunc: (t: T, index: number) => Thenable<boolean>): AwuIterable<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return awu(filterAsync(itr, filterFunc as any))
  }
  return {
    [Symbol.asyncIterator]: () => (isAsyncIterable(itr)
      ? itr[Symbol.asyncIterator]()
      : toAsyncIterable(itr)[Symbol.asyncIterator]()),
    filter: awuFilter,
    concat: (...iterables) => awu(concatAsync(itr, ...iterables)),
    toArray: () => toArrayAsync(itr),
    find: pred => findAsync(itr, pred),
    map: mapFunc => awu(mapAsync(itr, mapFunc)),
    flatMap: mapFunc => awu(flattenAsync(mapAsync(itr, mapFunc))),
    forEach: mapFunc => forEachAsync(itr, mapFunc),
    isEmpty: () => isEmptyAsync(itr),
    length: () => lengthAsync(itr),
    peek: () => peekAsync(itr),
    take: maxItems => awu(takeAsync(itr, maxItems)),
    flat: () => awu(flattenAsync(itr)),
    some: func => someAsync(itr, func),
    every: func => everyAsync(itr, func),
    keyBy: keyFunc => keyByAsync(itr, keyFunc),
    groupBy: keyFunc => groupByAsync(itr, keyFunc),
    uniquify: (toSetType: (t: T) => unknown) => awu(uniquify(itr, toSetType)),
    reduce: (reducer, initialValue) => reduceAsync(itr, reducer, initialValue),
  }
}
