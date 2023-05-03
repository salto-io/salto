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
import { remoteMap } from '@salto-io/workspace'
import { values } from '@salto-io/lowerdash'
import type rocksdb from '@salto-io/rocksdb'
import { NAMESPACE_SEPARATOR } from './constants'

export type RocksDBValue = string | Buffer | undefined

export type CreateIteratorOpts = remoteMap.IterationOpts & {
  keys: boolean
  values: boolean
}

export type ReadIterator = {
  next: () => Promise<remoteMap.RemoteMapEntry<string> | undefined>
  nextPage: () => Promise<remoteMap.RemoteMapEntry<string>[] | undefined>
}

const readIteratorNext = (
  iterator: rocksdb.Iterator,
): Promise<remoteMap.RemoteMapEntry<string> | undefined> =>
  new Promise<remoteMap.RemoteMapEntry<string> | undefined>(resolve => {
    const callback = (_err: Error | undefined, key: RocksDBValue, value: RocksDBValue): void => {
      const keyAsString = key?.toString()
      const cleanKey = keyAsString?.substr(keyAsString
        .indexOf(NAMESPACE_SEPARATOR) + NAMESPACE_SEPARATOR.length)
      if (value !== undefined && cleanKey !== undefined) {
        resolve({ key: cleanKey, value: value.toString() })
      } else {
        resolve(undefined)
      }
    }
    iterator.next(callback)
  })

const readIteratorPage = (
  iterator: rocksdb.Iterator,
): Promise<remoteMap.RemoteMapEntry<string>[] | undefined> =>
  new Promise<remoteMap.RemoteMapEntry<string>[] | undefined>(resolve => {
    const callback = (_err: Error | undefined, res: [RocksDBValue, RocksDBValue][]): void => {
      const result = res?.map(([key, value]) => {
        const keyAsString = key?.toString()
        const cleanKey = keyAsString?.substr(keyAsString
          .indexOf(NAMESPACE_SEPARATOR) + NAMESPACE_SEPARATOR.length)
        return { key: cleanKey, value: value?.toString() }
      }).filter(
        entry => values.isDefined(entry.key) && values.isDefined(entry.value)
      ) as remoteMap.RemoteMapEntry<string>[] ?? []
      if (result.length > 0) {
        resolve(result)
      } else {
        resolve(undefined)
      }
    }
    iterator.nextPage(callback)
  })

export async function *aggregatedIterable(iterators: ReadIterator[]):
  AsyncIterable<remoteMap.RemoteMapEntry<string>> {
  const latestEntries: (remoteMap.RemoteMapEntry<string> | undefined)[] = Array.from(
    { length: iterators.length }
  )
  await Promise.all(iterators.map(async (iter, i) => {
    latestEntries[i] = await iter.next()
  }))
  let done = false
  while (!done) {
    let min: string | undefined
    let minIndex = 0
    latestEntries.forEach((entry, index) => {
      if (entry !== undefined) {
        if (min === undefined || entry.key < min) {
          min = entry.key
          minIndex = index
        }
      }
    })
    const minEntry = min !== undefined ? latestEntries[minIndex] : undefined
    if (minEntry === undefined) {
      done = true
    } else {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(latestEntries.map(async (entry, i) => {
        // This skips all values with the same key because some keys can appear in two iterators
        if (entry !== undefined && entry.key === min) {
          latestEntries[i] = await iterators[i].next()
        }
      }))
      yield { key: minEntry.key, value: minEntry.value }
    }
  }
}

export async function *aggregatedIterablesWithPages(iterators: ReadIterator[], pageSize = 1000):
  AsyncIterable<remoteMap.RemoteMapEntry<string>[]> {
  const latestEntries: (remoteMap.RemoteMapEntry<string>[] | undefined)[] = Array.from(
    { length: iterators.length }
  )
  await Promise.all(iterators.map(async (iter, i) => {
    latestEntries[i] = await iter.nextPage()
  }))
  let done = false
  while (!done) {
    const page = []
    while (!done && page.length < pageSize) {
      let min: string | undefined
      let minIndex = 0
      latestEntries
        .forEach((entries, index) => {
          const entry = entries?.[0]
          if (entry !== undefined && (min === undefined || entry.key < min)) {
            min = entry.key
            minIndex = index
          }
        })
      const minEntry = min !== undefined ? latestEntries[minIndex]?.shift() : undefined
      if (minEntry === undefined) {
        done = true
      } else {
        for (let i = 0; i < latestEntries.length; i += 1) {
          const entries = latestEntries[i]
          // We load the next page for emptied out pages
          if (min !== undefined && entries && entries[0] !== undefined && entries[0].key <= min) {
            // This skips all values with the same key because some keys can appear in two iterators
            entries.shift()
          }
          if (entries?.length === 0) {
            // eslint-disable-next-line no-await-in-loop
            latestEntries[i] = await iterators[i].nextPage()
          }
        }
        page.push({ key: minEntry.key, value: minEntry.value })
      }
    }
    if (page.length > 0) {
      yield page
    }
  }
}

const createReadIterator = (
  iterator: rocksdb.Iterator,
): ReadIterator => ({
  next: () => readIteratorNext(iterator),
  nextPage: () => readIteratorPage(iterator),
})

const createFilteredReadIterator = (
  iterator: rocksdb.Iterator,
  filter: (x: string) => boolean,
  limit?: number,
): ReadIterator => {
  let iterated = 0
  return {
    next: () => {
      const getNext = async (): Promise<remoteMap.RemoteMapEntry<string> | undefined> => {
        if (limit !== undefined && iterated >= limit) {
          return undefined
        }
        const next = await readIteratorNext(iterator)
        if (next === undefined || filter(next.key)) {
          iterated += 1
          return next
        }
        return getNext()
      }
      return getNext()
    },
    nextPage: () => {
      const getNext = async (): Promise<remoteMap.RemoteMapEntry<string>[] | undefined> => {
        if (limit && iterated >= limit) {
          return undefined
        }
        const next = await readIteratorPage(iterator)
        if (next === undefined) {
          return undefined
        }
        const filteredPage = next.filter(ent => filter(ent.key))
        if (filteredPage.length === 0) {
          return getNext()
        }
        const actualPage = limit !== undefined
          ? filteredPage.slice(0, limit - iterated)
          : filteredPage
        iterated += actualPage.length
        return actualPage
      }
      return getNext()
    },
  }
}

export const createIterator = (opts: CreateIteratorOpts, connection: rocksdb, iterateFrom: string, iterateTo: string):
  ReadIterator => {
  // Cannot use inner limit when filtering because if we filter anything out we will need
  // to get additional results from the inner iterator
  const limit = opts.filter === undefined ? opts.first : undefined
  const connectionIterator = connection.iterator({
    keys: opts.keys,
    values: opts.values,
    lte: iterateTo,
    ...(opts.after !== undefined ? { gt: opts.after } : { gte: iterateFrom }),
    ...(limit !== undefined ? { limit } : {}),
  })
  return opts.filter === undefined
    ? createReadIterator(connectionIterator)
    : createFilteredReadIterator(connectionIterator, opts.filter, opts.first)
}
