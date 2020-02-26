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
import wu from 'wu'
import _ from 'lodash'

export const partition = async <T>(
  iterable: Iterable<T>,
  partitioner: (item: T) => Promise<boolean>
): Promise<[T[], T[]]> => {
  const i = iterable[Symbol.iterator]()
  const truthfull: T[] = []
  const nonThruthfull: T[] = []
  const next = async (): Promise<[T[], T[]]> => {
    const { done, value } = i.next()
    if (done) {
      return [truthfull, nonThruthfull]
    }
    const resultArr = await partitioner(value) ? truthfull : nonThruthfull
    resultArr.push(value)
    return next()
  }

  return next()
}

export const series = <T>(promises: Iterable<() => Promise<T>>): Promise<T[]> => {
  const i = promises[Symbol.iterator]()
  const result: T[] = []
  const next = async (): Promise<T[]> => {
    const { done, value } = i.next()
    if (done) {
      return result
    }
    result.push(await value())
    return next()
  }
  return next()
}

export const chunkSeries = async <T>(
  promises: Iterable<() => Promise<T>>, maxConcurrency: number
): Promise<T[]> => _.flatten(
  await series(
    wu(promises)
      .chunk(maxConcurrency)
      .map(chunk => () => Promise.all(chunk.map(f => f())))
  )
)
