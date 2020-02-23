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
import _ from 'lodash'

export const asyncPartition = async <T>(
  arr: T[],
  partitioner: (item: T) => Promise<boolean>
): Promise<[T[], T[]]> => {
  const truthfull = []
  const nonThruthfull = []
  // eslint-disable-next-line no-restricted-syntax
  for (const item of arr) {
    // eslint-disable-next-line no-await-in-loop
    if (await partitioner(item)) {
      truthfull.push(item)
    } else {
      nonThruthfull.push(item)
    }
  }
  return [truthfull, nonThruthfull]
}

export const promiseAllChained = <T>(funcs: (() => Promise<T>)[], chunkSize = 1): Promise<T[]> =>
  _.chunk(funcs, chunkSize).reduce<Promise<T[]>>((prevPromise, chunk) =>
    prevPromise.then(prev => Promise.all(chunk.map(f => f()))
      .then(chunkRes => [...prev, ...chunkRes])),
  Promise.resolve([]))
