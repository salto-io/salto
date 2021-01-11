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
import rocksdb from 'rocksdb'
import { promisify } from 'util'
import LRU from 'lru-cache'
import { remoteMap } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'

const { asynciterable } = collections
const { awu } = asynciterable
const NAMESPACE_SEPARATOR = '::'
const TEMP_PREFIX = '~TEMP~'

type Entry<T> = { key: string; value: T}
type RocksDBValue = string | Buffer | undefined

type CreateIteratorOpts = remoteMap.IterationOpts & {
  keys: boolean
  values: boolean
}

const readIteratorNext = (iterator: rocksdb
  .Iterator): Promise<Entry<string> | undefined> =>
  new Promise<Entry<string> | undefined>(resolve => {
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

export async function *aggregatedIterable(iterators: rocksdb.Iterator[]):
AsyncIterable<Entry<string>> {
  const latestEntries: (Entry<string> | undefined)[] = Array.from({ length: iterators.length })
  await Promise.all(iterators.map(async (iter, i) => {
    latestEntries[i] = await readIteratorNext(iter)
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
    const minEntry = min ? latestEntries[minIndex] : undefined
    if (minEntry === undefined) {
      done = true
    } else {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(latestEntries.map(async (entry, i) => {
        // This skips all values with the same key because some keys can appear in two iterators
        if (entry !== undefined && entry.key === min) {
          latestEntries[i] = await readIteratorNext(iterators[i])
        }
      }))
      yield { key: minEntry.key, value: minEntry.value }
    }
  }
}

const dbConnections: Record<string, rocksdb> = {}

export const createRemoteMap = async <T>(namespace: string, mapOptions: remoteMap.RemoteMapOptions,
  serialize: (value: T) => string,
  deserialize: (s: string) => Promise<T>,
  valueToKey: (value: T) => string): Promise<remoteMap.RemoteMap<T>> => {
  if (!/^[a-z0-9-]+$/i.test(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}. Must include only alphanumeric characters or -`)
  }
  const cache = new LRU<string, T>({ max: mapOptions.LRUSize })
  let db: rocksdb

  const keyToDBKey = (key: string): string =>
    namespace.concat(NAMESPACE_SEPARATOR).concat(key)

  const keyToTempDBKey = (key: string): string =>
    TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR).concat(key))

  // We calculate a different key according to whether we're
  // looking for a temp value or a regular value
  const getAppropriateKey = (key: string, temp = false): string =>
    (temp ? keyToTempDBKey(key) : keyToDBKey(key))

  const getPrefixEndCondition = (prefix: string): string => prefix
    .substring(0, prefix.length - 1).concat((String
      .fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)))

  const createIterator = (prefix: string, opts: CreateIteratorOpts):
  rocksdb.Iterator =>
    db.iterator({
      keys: true,
      values: true,
      lte: getPrefixEndCondition(prefix),
      ...(opts.after !== undefined ? { gt: opts.after } : { gte: prefix }),
      ...(opts.first !== undefined ? { limit: opts.first } : {}),
    })

  const createTempIterator = (opts: CreateIteratorOpts): rocksdb.Iterator => {
    const normalizedOpts = {
      ...opts,
      ...(opts.after ? { after: keyToTempDBKey(opts.after) } : {}),
    }
    return createIterator(
      TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR)),
      normalizedOpts
    )
  }

  const createPersistentIterator = (opts: CreateIteratorOpts): rocksdb.Iterator => {
    const normalizedOpts = {
      ...opts,
      ...(opts.after ? { after: keyToDBKey(opts.after) } : {}),
    }
    return createIterator(namespace.concat(NAMESPACE_SEPARATOR), normalizedOpts)
  }

  const putAllImpl = async (elements: AsyncIterable<T>, temp = true): Promise<void> => {
    let i = 0
    let batch = db.batch()
    for await (const element of elements) {
      i += 1
      cache.set(valueToKey(element), element)
      batch.put(getAppropriateKey(valueToKey(element), temp), serialize(element))
      if (i % mapOptions.batchInterval === 0) {
        await promisify(batch.write.bind(batch))()
        batch = db.batch()
      }
    }
    if (i % mapOptions.batchInterval !== 0) {
      await promisify(batch.write.bind(batch))()
    }
  }

  const valuesImpl = (tempOnly = false, iterationOpts?: remoteMap.IterationOpts):
  AsyncIterable<T> => {
    const opts = { ...(iterationOpts ?? {}), keys: false, values: true }
    const tempIter = createTempIterator(opts)
    const iter = createPersistentIterator(opts)
    return awu(aggregatedIterable(tempOnly ? [tempIter] : [tempIter, iter]))
      .map(async entry => deserialize(entry.value))
  }

  const clearImpl = (prefix: string): Promise<void> => new Promise<void>(resolve => {
    db.clear({
      gte: prefix,
      lte: getPrefixEndCondition(prefix),
    }, () => {
      resolve()
    })
  })

  const createDBIfNotCreated = async (loc: string): Promise<void> => {
    if (!(loc in dbConnections)) {
      db = rocksdb(loc)
      dbConnections[loc] = db
      await promisify(db.open.bind(db))()
      await clearImpl(TEMP_PREFIX)
    } else {
      db = dbConnections[loc]
    }
  }
  await createDBIfNotCreated(mapOptions.dbLocation)

  return {
    get: async (key: string): Promise<T | undefined> => new Promise(resolve => {
      if (cache.has(key)) {
        resolve(cache.get(key) as T)
      } else {
        const resolveRet = async (value: Buffer | string): Promise<void> => {
          const ret = (await deserialize(value.toString()))
          cache.set(key, ret)
          resolve(ret)
        }
        db.get(keyToTempDBKey(key), async (error, value) => {
          if (error) {
            db.get(keyToDBKey(key), async (innerError, innerValue) => {
              if (innerError) {
                resolve(undefined)
              } else {
                await resolveRet(innerValue)
              }
            })
          } else {
            await resolveRet(value)
          }
        })
      }
    }),
    values: (iterationOpts?: remoteMap.IterationOpts) =>
      valuesImpl(false, iterationOpts),
    entries: (iterationOpts?: remoteMap.IterationOpts) => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const tempIter = createTempIterator(opts)
      const iter = createPersistentIterator(opts)
      return awu(aggregatedIterable([tempIter, iter]))
        .map(async entry => ({ key: entry.key, value: await deserialize(entry.value) }))
    },
    set: async (key: string, element: T): Promise<void> => {
      cache.set(key, element)
      await promisify(db.put.bind(db))(keyToTempDBKey(key), serialize(element))
    },
    putAll: putAllImpl,
    list: (iterationOpts?: remoteMap.IterationOpts) => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
      const tempKeyIter = createTempIterator(opts)
      const keyIter = createPersistentIterator(opts)
      return awu(aggregatedIterable([tempKeyIter, keyIter]))
        .map(async (entry: Entry<string>) => entry.key)
    },
    flush: async () => {
      await putAllImpl(valuesImpl(true), false)
      await clearImpl(TEMP_PREFIX.concat(namespace).concat(NAMESPACE_SEPARATOR))
    },
    revert: async () => {
      await clearImpl(TEMP_PREFIX.concat(namespace).concat(NAMESPACE_SEPARATOR))
    },
    close: () => promisify(db.close.bind(db))(),
  }
}
