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

export const toArrayAsync = async <T>(
  iterable: AsyncIterable<T>,
): Promise<Array<T>> => {
  const res: T[] = []
  for await (const curr of iterable) {
    res.push(curr)
  }
  return res
}
