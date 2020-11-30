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

type Thenable<T> = T | Promise<T>
type ThenableIterable<T> = Iterable<T> | AsyncIterable<T>

const isAsyncIterable = <T>(
  itr: ThenableIterable<T>
): itr is AsyncIterable<T> => Symbol.asyncIterator in itr

export const toAsyncIterable = <T>(i: Iterable<T>): AsyncIterable<T> => {
  const iter = i[Symbol.iterator]()
  return {
    [Symbol.asyncIterator]: (): AsyncIterator<T> => ({
      next: async () => iter.next(),
    }),
  }
}

export const findAsync = async <T>(
  i: ThenableIterable<T>,
  pred: (value: T, index: number) => Thenable<boolean>,
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

export async function *filterAsync<T>(
  itr: ThenableIterable<T>,
  filterFunc: (t: T, index: number) => Thenable<boolean>
): AsyncIterable<T> {
  let index = 0
  for await (const item of itr) {
    if (await filterFunc(item, index)) {
      yield item
    }
    index += 1
  }
}

export async function *flattenAsync<T>(
  ...iterables: ThenableIterable<ThenableIterable<T>>[]
): AsyncIterable<T> {
  for (const itr of iterables) {
    // eslint-disable-next-line no-await-in-loop
    for await (const nestedItr of itr) {
      for await (const item of nestedItr) {
        yield item
      }
    }
  }
}

export type AwuIterable<T> = AsyncIterable<T> & {
  filter(filterFunc: (t: T, index: number) => Thenable<boolean>): AwuIterable<T>
  concat(...iterables: ThenableIterable<T>[]): AwuIterable<T>
  toArray(): Promise<Array<T>>
  map<U>(mapFunc: (t: T, index: number) => Thenable<U>): AwuIterable<U>
  find(pred: (value: T, index: number) => Thenable<boolean>): Promise<T | undefined>
  flatMap<U>(mapFunc: (t: T, index: number) => Thenable<ThenableIterable<U>>): AwuIterable<U>
}

export const awu = <T>(itr: ThenableIterable<T>): AwuIterable<T> => ({
  [Symbol.asyncIterator]: () => (isAsyncIterable(itr)
    ? itr[Symbol.asyncIterator]()
    : toAsyncIterable(itr)[Symbol.asyncIterator]()),
  filter: filterFunc => awu(filterAsync(itr, filterFunc)),
  concat: (...iterables) => awu(concatAsync(itr, ...iterables)),
  toArray: () => toArrayAsync(itr),
  find: pred => findAsync(itr, pred),
  map: mapFunc => awu(mapAsync(itr, mapFunc)),
  flatMap: mapFunc => awu(flattenAsync(mapAsync(itr, mapFunc))),
})
