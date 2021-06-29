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
import { promisify } from 'util'
import AsyncLock from 'async-lock'
import LRU from 'lru-cache'
import uuidv4 from 'uuid/v4'
import * as fileUtils from '@salto-io/file'
import { remoteMap } from '@salto-io/workspace'
import { collections, promises, values } from '@salto-io/lowerdash'
import type rocksdb from '@salto-io/rocksdb'
import path from 'path'

const { asynciterable } = collections
const { awu } = asynciterable
const { withLimitedConcurrency } = promises.array
const NAMESPACE_SEPARATOR = '::'
const TEMP_PREFIX = '~TEMP~'
const UNIQUE_ID_SEPARATOR = '%%'
const DELETE_OPERATION = 1
const SET_OPERATION = 0
const GET_CONCURRENCY = 100
export const TMP_DB_DIR = 'tmp-dbs'
export type RocksDBValue = string | Buffer | undefined

type CreateIteratorOpts = remoteMap.IterationOpts & {
  keys: boolean
  values: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rocksdbImpl: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getRemoteDbImpl = (): any => {
  if (rocksdbImpl === undefined) {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    rocksdbImpl = require('./rocksdb').default
  }
  return rocksdbImpl
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

const readIteratorPage = (iterator: rocksdb
    .Iterator): Promise<remoteMap.RemoteMapEntry<string>[] | undefined> =>
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
    const minEntry = min !== undefined ? latestEntries[minIndex] : undefined
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

export async function *aggregatedIterablesWithPages(iterators: rocksdb.Iterator[], pageSize = 1000):
AsyncIterable<remoteMap.RemoteMapEntry<string>[]> {
  const latestEntries: (remoteMap.RemoteMapEntry<string>[] | undefined)[] = Array.from(
    { length: iterators.length }
  )
  await Promise.all(iterators.map(async (iter, i) => {
    latestEntries[i] = await readIteratorPage(iter)
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
            latestEntries[i] = await readIteratorPage(iterators[i])
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

const MAX_CONNECTIONS = 1000
const persistentDBConnections: Record<string, Promise<rocksdb>> = {}
const tmpDBConnections: Record<string, Record<string, Promise<rocksdb>>> = {}
let currentConnectionsCount = 0

const closeConnection = async (location: string, connection: Promise<rocksdb>): Promise<void> => {
  const dbConnection = await connection
  await promisify(dbConnection.close.bind(dbConnection))()
  delete persistentDBConnections[location]
}

const closeTmpConnection = async (
  location: string,
  tmpLocation: string,
  connection: Promise<rocksdb>
): Promise<void> => {
  const dbConnection = await connection
  await promisify(dbConnection.close.bind(dbConnection))()
  await promisify(getRemoteDbImpl().destroy.bind(getRemoteDbImpl(), tmpLocation))()
  delete (tmpDBConnections[location] ?? {})[tmpLocation]
}

export const closeAllRemoteMaps = async (): Promise<void> => {
  await awu(Object.entries(persistentDBConnections)).forEach(async ([loc, connection]) => {
    await closeConnection(loc, connection)
  })
  await awu(Object.entries(tmpDBConnections)).forEach(async ([loc, tmpConnections]) => {
    await awu(Object.entries(tmpConnections)).forEach(async ([tmpLoc, connection]) => {
      await closeTmpConnection(loc, tmpLoc, connection)
    })
  })
}

export const closeRemoteMapsOfLocation = async (location: string): Promise<void> => {
  const connection = persistentDBConnections[location]
  if (connection) {
    await closeConnection(location, connection)
  }
  const tmpConnections = tmpDBConnections[location]
  if (tmpConnections) {
    await awu(Object.entries(tmpConnections)).forEach(([tmpLoc, tmpCon]) => (
      closeTmpConnection(location, tmpLoc, tmpCon)
    ))
  }
}

export const replicateDB = async (
  srcDbLocation: string, dstDbLocation: string, backupDir: string
): Promise<void> => {
  await promisify(
    getRemoteDbImpl().replicate.bind(getRemoteDbImpl(), srcDbLocation, dstDbLocation, backupDir)
  )()
}

const creatorLock = new AsyncLock()
const withCreatorLock = async (fn: (() => Promise<void>)): Promise<void> => {
  await creatorLock.acquire('createInProgress', fn)
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const locationCaches = new LRU<string, LRU<string, any>>({ max: 10 })

export const createRemoteMapCreator = (location: string,
  persistentDefaultValue = false,
  cacheSize = 5000):
remoteMap.RemoteMapCreator => {
  // Note: once we set a non-zero cache size,
  //   we won't change the cache size even if we give different value
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let locationCache: LRU<string, any>
  if (locationCaches.has(location)) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    locationCache = locationCaches.get(location) as LRU<string, any>
  } else {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    locationCache = new LRU<string, any>({ max: cacheSize })
    if (cacheSize > 0) {
      locationCaches.set(location, locationCache)
    }
  }
  return async <T, K extends string = string>(
    { namespace,
      batchInterval = 1000,
      persistent = persistentDefaultValue,
      serialize,
      deserialize }:
    remoteMap.CreateRemoteMapParams<T>
  ): Promise<remoteMap.RemoteMap<T, K> > => {
    const delKeys = new Set<string>()
    const locationTmpDir = path.join(location, TMP_DB_DIR)
    if (!await fileUtils.exists(location)) {
      await fileUtils.mkdirp(location)
    }
    if (!await fileUtils.exists(locationTmpDir)) {
      await fileUtils.mkdirp(locationTmpDir)
    }
    if (!/^[a-z0-9-_\s/]+$/i.test(namespace)) {
      throw new Error(
        `Invalid namespace: ${namespace}. Must include only alphanumeric characters or -`
      )
    }
    let persistentDB: rocksdb
    let tmpDB: rocksdb

    const uniqueId = uuidv4()
    const tmpLocation = path.join(locationTmpDir, uniqueId)
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
    const createIterator = (prefix: string, opts: CreateIteratorOpts, connection: rocksdb):
    rocksdb.Iterator =>
      connection.iterator({
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
        normalizedOpts,
        tmpDB
      )
    }
    const createPersistentIterator = (opts: CreateIteratorOpts): rocksdb.Iterator => {
      const normalizedOpts = {
        ...opts,
        ...(opts.after ? { after: keyToDBKey(opts.after) } : {}),
      }
      return createIterator(keyPrefix, normalizedOpts, persistentDB)
    }
    const batchUpdate = async (
      batchInsertIterator: AsyncIterable<remoteMap.RemoteMapEntry<string, string>>,
      temp = true,
      operation = SET_OPERATION,
    ): Promise<boolean> => {
      const connection = temp ? tmpDB : persistentDB
      let i = 0
      let batch = connection.batch()
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
          batch = connection.batch()
        }
      }
      if (i % batchInterval !== 0) {
        await promisify(batch.write.bind(batch))()
      }
      return i > 0
    }
    const setAllImpl = async (
      elementsEntries: AsyncIterable<remoteMap.RemoteMapEntry<T, K>>,
      temp = true,
    ): Promise<void> => {
      const batchInsertIterator = awu(elementsEntries).map(entry => {
        delKeys.delete(entry.key)
        locationCache.set(keyToTempDBKey(entry.key), entry.value)
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
        .filter(entry => !delKeys.has(entry.key))
        .map(async entry => deserialize(entry.value))
    }
    const valuesPagesImpl = (tempOnly = false, iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<T[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const tempIter = createTempIterator(opts)
      const iter = createPersistentIterator(opts)
      return awu(aggregatedIterablesWithPages(
        tempOnly ? [tempIter] : [tempIter, iter],
        opts.pageSize
      )).map(async entries => Promise.all(entries.map(entry => deserialize(entry.value))))
    }
    const entriesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<remoteMap.RemoteMapEntry<T, K>> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const tempIter = createTempIterator(opts)
      const iter = createPersistentIterator(opts)
      return awu(aggregatedIterable([tempIter, iter]))
        .map(
          async entry => ({ key: entry.key as K, value: await deserialize(entry.value) })
        )
    }
    const entriesPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<remoteMap.RemoteMapEntry<T, K>[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const tempIter = createTempIterator(opts)
      const iter = createPersistentIterator(opts)
      return awu(aggregatedIterablesWithPages([tempIter, iter], opts.pageSize))
        .map(entries => Promise.all(
          entries
            .filter(entry => !delKeys.has(entry.key))
            .map(
              async entry => ({ key: entry.key as K, value: await deserialize(entry.value) })
            )
        ))
    }
    const clearImpl = (
      connection: rocksdb,
      prefix: string,
      suffix?: string
    ): Promise<void> =>
      new Promise<void>(resolve => {
        connection.clear({
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
        .filter(key => !delKeys.has(key))
    }
    const keysPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<K[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
      const tempKeyIter = createTempIterator(opts)
      const keyIter = createPersistentIterator(opts)
      return awu(aggregatedIterablesWithPages([tempKeyIter, keyIter], opts.pageSize))
        .map(async entries => entries.map(entry => entry.key as K))
    }
    const getImpl = (key: string): Promise<T | undefined> => new Promise(resolve => {
      if (delKeys.has(key)) {
        resolve(undefined)
      }
      if (locationCache.has(keyToTempDBKey(key))) {
        resolve(locationCache.get(keyToTempDBKey(key)) as T)
      } else {
        const resolveRet = async (value: Buffer | string): Promise<void> => {
          const ret = (await deserialize(value.toString()))
          locationCache.set(keyToTempDBKey(key), ret)
          resolve(ret)
        }
        tmpDB.get(keyToTempDBKey(key), async (error, value) => {
          if (error) {
            persistentDB.get(keyToDBKey(key), async (innerError, innerValue) => {
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
    })
    const closeImpl = async (): Promise<void> => {
      if (persistentDB.status === 'open') {
        await closeConnection(location, Promise.resolve(persistentDB))
        currentConnectionsCount -= 1
      }
      if (tmpDB.status === 'open') {
        await closeTmpConnection(location, tmpLocation, Promise.resolve(tmpDB))
        currentConnectionsCount -= 1
      }
    }
    const getOpenDBConnection = async (
      loc: string,
      isReadOnly: boolean
    ): Promise<rocksdb> => {
      const newDb = getRemoteDbImpl()(loc)
      await promisify(newDb.open.bind(newDb, { readOnly: isReadOnly }))()
      return newDb
    }
    const createDBIfNotExist = async (loc: string): Promise<void> => {
      const newDb: rocksdb = getRemoteDbImpl()(loc)
      try {
        await promisify(newDb.open.bind(newDb, { readOnly: true }))()
        await promisify(newDb.close.bind(newDb))()
      } catch (e) {
        if (newDb.status === 'new') {
          await withCreatorLock(async () => {
            await promisify(newDb.open.bind(newDb))()
            await promisify(newDb.close.bind(newDb))()
          })
        }
      }
    }
    const createDBConnections = async (): Promise<void> => {
      if (tmpDB === undefined) {
        const tmpConnection = getOpenDBConnection(tmpLocation, false)
        tmpDB = await tmpConnection
        tmpDBConnections[location] = tmpDBConnections[location] ?? {}
        tmpDBConnections[location][tmpLocation] = tmpConnection
      }
      if (location in persistentDBConnections) {
        persistentDB = await persistentDBConnections[location]
        return
      }
      if (currentConnectionsCount > MAX_CONNECTIONS) {
        throw new Error('Failed to open rocksdb connection - too much open connections already')
      }
      const connectionPromise = (async () => {
        currentConnectionsCount += 2
        await createDBIfNotExist(location)
        const readOnly = !persistent
        return getOpenDBConnection(location, readOnly)
      })()
      if (persistent) {
        persistentDBConnections[location] = connectionPromise
      }
      persistentDB = await connectionPromise
    }
    await createDBConnections()
    return {
      get: getImpl,
      getMany: async (keys: string[]): Promise<(T | undefined)[]> =>
        withLimitedConcurrency(keys.map(k => () => getImpl(k)), GET_CONCURRENCY),
      values: <Opts extends remoteMap.IterationOpts>(iterationOpts?: Opts) => {
        if (iterationOpts && remoteMap.isPagedIterationOpts(iterationOpts)) {
          return valuesPagesImpl(false, iterationOpts) as remoteMap.RemoteMapIterator<T, Opts>
        }
        return valuesImpl(false, iterationOpts)
      },
      entries: <Opts extends remoteMap.IterationOpts>(
        iterationOpts?: Opts
      ): remoteMap.RemoteMapIterator<remoteMap.RemoteMapEntry<T, K>, Opts> => {
        if (iterationOpts && remoteMap.isPagedIterationOpts(iterationOpts)) {
          return entriesPagesImpl(
            iterationOpts
          ) as remoteMap.RemoteMapIterator<remoteMap.RemoteMapEntry<T, K>, Opts>
        }
        return entriesImpl(
          iterationOpts
        ) as remoteMap.RemoteMapIterator<remoteMap.RemoteMapEntry<T, K>, Opts>
      },
      set: async (key: string, element: T): Promise<void> => {
        delKeys.delete(key)
        locationCache.set(keyToTempDBKey(key), element)
        await promisify(tmpDB.put.bind(tmpDB))(keyToTempDBKey(key), serialize(element))
      },
      setAll: setAllImpl,
      deleteAll: async (iterator: AsyncIterable<K>) => awu(iterator).forEach(k => delKeys.add(k)),
      keys: <Opts extends remoteMap.IterationOpts>(
        iterationOpts?: Opts
      ): remoteMap.RemoteMapIterator<K, Opts> => {
        if (iterationOpts && remoteMap.isPagedIterationOpts(iterationOpts)) {
          return keysPagesImpl(iterationOpts) as remoteMap.RemoteMapIterator<K, Opts>
        }
        return keysImpl(iterationOpts) as remoteMap.RemoteMapIterator<K, Opts>
      },
      flush: async () => {
        if (!persistent) {
          throw new Error('can not flush a non persistent remote map')
        }
        const writeRes = await batchUpdate(awu(aggregatedIterable(
          [createTempIterator({ keys: true, values: true })]
        )), false)
        await clearImpl(tmpDB, tempKeyPrefix)
        const readRes = await batchUpdate(
          awu(delKeys.keys()).map(async key => ({ key, value: key })),
          false,
          DELETE_OPERATION
        )
        return writeRes || readRes
      },
      revert: async () => {
        locationCache.reset()
        delKeys.clear()
        await clearImpl(tmpDB, tempKeyPrefix)
      },
      clear: async () => {
        locationCache.reset()
        await clearImpl(persistentDB, keyPrefix)
        await clearImpl(tmpDB, tempKeyPrefix)
      },
      delete: async (key: string) => {
        delKeys.add(key)
      },
      close: closeImpl,
      has: async (key: string): Promise<boolean> => {
        if (locationCache.has(keyToTempDBKey(key))) {
          return true
        }
        const hasKeyImpl = (k: string, db: rocksdb): boolean => {
          let val: RocksDBValue
          db.get(k, async (error, value) => {
            val = error ? undefined : value
          })
          return val !== undefined
        }
        return hasKeyImpl(keyToTempDBKey(key), tmpDB)
          || hasKeyImpl(keyToDBKey(key), persistentDB)
      },
      isEmpty: async (): Promise<boolean> => awu(keysImpl({ first: 1 })).isEmpty(),
    }
  }
}
