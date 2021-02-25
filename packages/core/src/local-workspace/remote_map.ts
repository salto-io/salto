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
import rocksdb from 'rocksdb'
import { promisify } from 'util'
import LRU from 'lru-cache'
import { remoteMap } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import uuidv4 from 'uuid/v4'


const { asynciterable } = collections
const { awu } = asynciterable
const NAMESPACE_SEPARATOR = '::'
const TEMP_PREFIX = '~TEMP~'
const UNIQUE_ID_SEPARATOR = '%%'
const DELETE_OPERATION = 1
const SET_OPERATION = 0
type RocksDBValue = string | Buffer | undefined
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const cache = new LRU<string, any>({ max: 5000 })

type CreateIteratorOpts = remoteMap.IterationOpts & {
  keys: boolean
  values: boolean
}

const readIteratorNext = (iterator: rocksdb
  .Iterator): Promise<remoteMap.RemoteMapEntry<string> | undefined> =>
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

export async function *aggregatedIterable(iterators: rocksdb.Iterator[]):
AsyncIterable<remoteMap.RemoteMapEntry<string>> {
  const latestEntries: (remoteMap.RemoteMapEntry<string> | undefined)[] = Array.from(
    { length: iterators.length }
  )
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

const dbConnections: Record<string, Promise<rocksdb>> = {}

export const createRemoteMapCreator = (location: string):
remoteMap.RemoteMapCreator => async <T, K extends string = string>(
  { namespace, batchInterval = 1000, serialize, deserialize }:
  remoteMap.CreateRemoteMapParams<T>
): Promise<remoteMap.RemoteMap<T, K>> => {
  if (!/^[a-z0-9-_/]+$/i.test(namespace)) {
    throw new Error(
      `Invalid namespace: ${namespace}. Must include only alphanumeric characters or -`
    )
  }
  let db: rocksdb
  const uniqueId = uuidv4()
  const keyPrefix = namespace.concat(NAMESPACE_SEPARATOR)
  const tempKeyPrefix = TEMP_PREFIX.concat(UNIQUE_ID_SEPARATOR, uniqueId, UNIQUE_ID_SEPARATOR,
    keyPrefix)
  const keyToDBKey = (key: string): string => namespace.concat(NAMESPACE_SEPARATOR, key)
  const keyToTempDBKey = (key: string): string => tempKeyPrefix.concat(key)

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
      keys: opts.keys,
      values: opts.values,
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
      tempKeyPrefix,
      normalizedOpts
    )
  }

  const createPersistentIterator = (opts: CreateIteratorOpts): rocksdb.Iterator => {
    const normalizedOpts = {
      ...opts,
      ...(opts.after ? { after: keyToDBKey(opts.after) } : {}),
    }
    return createIterator(keyPrefix, normalizedOpts)
  }

  const batchUpdate = async (
    batchInsertIterator: AsyncIterable<remoteMap.RemoteMapEntry<string, string>>,
    temp = true,
    operation = SET_OPERATION,
  ): Promise<void> => {
    let i = 0
    let batch = db.batch()
    for await (const entry of batchInsertIterator) {
      i += 1
      if (operation === SET_OPERATION) {
        batch.put(getAppropriateKey(entry.key, temp), entry.value)
      } else {
        batch.del(getAppropriateKey(entry.key, true))
        batch.del(getAppropriateKey(entry.key, false))
      }
      if (i % batchInterval === 0) {
        await promisify(batch.write.bind(batch))()
        batch = db.batch()
      }
    }
    if (i % batchInterval !== 0) {
      await promisify(batch.write.bind(batch))()
    }
  }
  const setAllImpl = async (
    elementsEntries: AsyncIterable<remoteMap.RemoteMapEntry<T, K>>,
    temp = true,
  ): Promise<void> => {
    const batchInsertIterator = awu(elementsEntries).map(entry => {
      cache.set(keyToTempDBKey(entry.key), entry.value)
      return { key: entry.key, value: serialize(entry.value) }
    })
    await batchUpdate(batchInsertIterator, temp)
  }

  const valuesImpl = (tempOnly = false, iterationOpts?: remoteMap.IterationOpts):
  AsyncIterable<T> => {
    const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
    const tempIter = createTempIterator(opts)
    const iter = createPersistentIterator(opts)
    return awu(aggregatedIterable(tempOnly ? [tempIter] : [tempIter, iter]))
      .map(async entry => deserialize(entry.value))
  }

  const entriesImpl = (iterationOpts?: remoteMap.IterationOpts):
  AsyncIterable<remoteMap.RemoteMapEntry<T, K>> => {
    const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
    const tempIter = createTempIterator(opts)
    const iter = createPersistentIterator(opts)
    return awu(aggregatedIterable([tempIter, iter]))
      .map(async entry => ({ key: entry.key as K, value: await deserialize(entry.value) }))
  }

  const clearImpl = (prefix: string, suffix?: string): Promise<void> =>
    new Promise<void>(resolve => {
      db.clear({
        gte: prefix,
        lte: suffix ?? getPrefixEndCondition(prefix),
      }, () => {
        resolve()
      })
    })

  const keysImpl = (iterationOpts?: remoteMap.IterationOpts): AsyncIterable<K> => {
    const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
    const tempKeyIter = createTempIterator(opts)
    const keyIter = createPersistentIterator(opts)
    return awu(aggregatedIterable([tempKeyIter, keyIter]))
      .map(async (entry: remoteMap.RemoteMapEntry<string>) => entry.key as K)
  }
  const getOpebDBConnection = async (loc: string): Promise<rocksdb> => {
    const newDb = rocksdb(loc)
    await promisify(newDb.open.bind(newDb))()
    return newDb
  }
  const createDBIfNotCreated = async (loc: string): Promise<void> => {
    if (!(loc in dbConnections)) {
      dbConnections[loc] = getOpebDBConnection(loc)
      db = await dbConnections[loc]
      await clearImpl(TEMP_PREFIX)
    } else {
      db = await dbConnections[loc]
    }
  }
  await createDBIfNotCreated(location)
  return {
    get: async (key: string): Promise<T | undefined> => new Promise(resolve => {
      if (cache.has(keyToTempDBKey(key))) {
        resolve(cache.get(keyToTempDBKey(key)) as T)
      } else {
        const resolveRet = async (value: Buffer | string): Promise<void> => {
          const ret = (await deserialize(value.toString()))
          cache.set(keyToTempDBKey(key), ret)
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
    values: (iterationOpts?: remoteMap.IterationOpts) => valuesImpl(false, iterationOpts),
    entries: (iterationOpts?: remoteMap.IterationOpts) => entriesImpl(iterationOpts),
    set: async (key: string, element: T): Promise<void> => {
      cache.set(keyToTempDBKey(key), element)
      await promisify(db.put.bind(db))(keyToTempDBKey(key), serialize(element))
    },
    setAll: setAllImpl,
    deleteAll: async (iterator: AsyncIterable<K>) => {
      await batchUpdate(awu(iterator).map(async key => ({ key, value: key })),
        false, DELETE_OPERATION)
    },
    keys: keysImpl,
    flush: async () => {
      await batchUpdate(awu(aggregatedIterable(
        [createTempIterator({ keys: true, values: true })]
      )), false)
      await clearImpl(tempKeyPrefix)
    },
    revert: async () => {
      cache.reset()
      await clearImpl(tempKeyPrefix)
    },
    clear: async () => {
      cache.reset()
      await clearImpl(keyPrefix)
      await clearImpl(tempKeyPrefix)
    },
    delete: async (key: string) => {
      cache.del(keyToTempDBKey(key))
      await clearImpl(keyToDBKey(key), keyToDBKey(key))
      await clearImpl(keyToTempDBKey(key), keyToTempDBKey(key))
    },
    close: () => promisify(db.close.bind(db))(),

    has: async (key: string): Promise<boolean> => {
      if (cache.has(keyToTempDBKey(key))) {
        return true
      }
      const hasKeyImpl = (k: string): boolean => {
        let val: RocksDBValue
        db.get(k, async (error, value) => {
          val = error ? undefined : value
        })
        return val !== undefined
      }
      return hasKeyImpl(keyToTempDBKey(key)) || hasKeyImpl(keyToDBKey(key))
    },
  }
}
