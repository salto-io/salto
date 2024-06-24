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
const asyncToArray = <T>(i: AsyncIterable<T>): Promise<ReadonlyArray<T>> => {
  const result: T[] = []
  const iter = i[Symbol.asyncIterator]()
  const next = async (): Promise<T[]> => {
    const { done, value } = await iter.next()
    if (done) {
      return result
    }
    result.push(value)
    return next()
  }
  return next()
}

export default asyncToArray
