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
export const findAsync = async <T>(
  i: AsyncIterable<T>,
  pred: (value: T, index: number) => boolean | Promise<boolean>,
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
  itr: AsyncIterable<T>,
  mapFunc: (t: T, index: number) => U | Promise<U>,
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
  itr: AsyncIterable<T>,
  func: (t: T, index: number) => unknown,
): Promise<void> => {
  let index = 0
  for await (const curr of itr) {
    await func(curr, index)
    index += 1
  }
}

export async function *toAsyncIterable<T>(iterable: Iterable<T>): AsyncIterable<T> {
  for (const item of iterable) {
    yield item
  }
}


export const toArrayAsync = async <T>(
  iterable: AsyncIterable<T>,
): Promise<Array<T>> => {
  const res: T[] = []
  for await (const curr of iterable) {
    res.push(curr)
  }
  return res
}

export function filterAsync<T, S extends T>(
  itr: AsyncIterable<T>,
  filterFunc: (t: T, index: number) => t is S
): AsyncIterable<S>
export function filterAsync<T>(
  itr: AsyncIterable<T>,
  filterFunc: (t: T, index: number) => boolean | Promise<boolean>
): AsyncIterable<T>
export async function *filterAsync<T>(
  itr: AsyncIterable<T>,
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
