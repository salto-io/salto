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
import path from 'path'
import { promisify } from 'util'
import AsyncLock from 'async-lock'
import { v4 as uuidv4 } from 'uuid'
import uniq from 'lodash/uniq'
import * as fileUtils from '@salto-io/file'
import { remoteMap } from '@salto-io/workspace'
import { collections, promises, values } from '@salto-io/lowerdash'
import type rocksdb from '@salto-io/rocksdb'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { remoteMapLocations } from './location_pool'

const { asynciterable } = collections
const { awu } = asynciterable
const { withLimitedConcurrency } = promises.array
const NAMESPACE_SEPARATOR = '::'
const TEMP_PREFIX = '~TEMP~'
const UNIQUE_ID_SEPARATOR = '%%'
const DELETE_OPERATION = 1
const SET_OPERATION = 0
const GET_CONCURRENCY = 100
const log = logger(module)

export const TMP_DB_DIR = 'tmp-dbs'
export type RocksDBValue = string | Buffer | undefined

type CreateIteratorOpts = remoteMap.IterationOpts & {
  keys: boolean
  values: boolean
}
type ConnectionPool = Record<string, Promise<rocksdb>>

type ReadIterator = {
  next: () => Promise<remoteMap.RemoteMapEntry<string> | undefined>
  nextPage: () => Promise<remoteMap.RemoteMapEntry<string>[] | undefined>
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

const isDBLockErr = (error: Error): boolean =>
  error.message.includes('LOCK: Resource temporarily unavailable')
  || error.message.includes('lock hold by current process')
  || error.message.includes('LOCK: The process cannot access the file because it is being used by another process')

const isDBNotExistErr = (error: Error): boolean => (
  error.message.includes('LOCK: No such file or directory')
)

class DBLockError extends Error {
  constructor() {
    super('Salto local database locked. Could another Salto process '
    + 'or a process using Salto be open?')
  }
}

const getDBTmpDir = (location: string): string => path.join(location, TMP_DB_DIR)

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

export const MAX_CONNECTIONS = 1000
const persistentDBConnections: ConnectionPool = {}
const readonlyDBConnections: ConnectionPool = {}
const tmpDBConnections: Record<string, ConnectionPool> = {}
const readonlyDBConnectionsPerRemoteMap: Record<string, ConnectionPool> = {}
let currentConnectionsCount = 0

const deleteLocation = async (location: string): Promise<void> => {
  try {
    await promisify(getRemoteDbImpl().destroy.bind(getRemoteDbImpl(), location))()
  } catch (e) {
    // If the DB does not exist, we don't want to throw error upon destroy
    if (!isDBNotExistErr(e as Error)) {
      throw e
    }
  }
}

const closeDanglingConnection = async (connection: Promise<rocksdb>): Promise<void> => {
  const dbConnection = await connection
  if (dbConnection.status === 'open') {
    await promisify(dbConnection.close.bind(dbConnection))()
    currentConnectionsCount -= 1
  }
}

const closeConnection = async (
  location: string, connection: Promise<rocksdb>, connPool: ConnectionPool
): Promise<void> => {
  await closeDanglingConnection(connection)
  delete connPool[location]
  log.debug('closed connection to %s', location)
}

const closeTmpConnection = async (
  location: string,
  tmpLocation: string,
  connection: Promise<rocksdb>
): Promise<void> => {
  await closeDanglingConnection(connection)
  await deleteLocation(tmpLocation)
  delete (tmpDBConnections[location] ?? {})[tmpLocation]
  log.debug('closed temporary connection to %s', tmpLocation)
}

export const closeRemoteMapsOfLocation = async (location: string): Promise<void> => {
  const persistentConnection = persistentDBConnections[location]
  if (await persistentConnection) {
    await closeConnection(location, persistentConnection, persistentDBConnections)
  }
  const tmpConnections = tmpDBConnections[location]
  if (tmpConnections) {
    await awu(Object.entries(tmpConnections)).forEach(async ([tmpLoc, tmpCon]) => {
      await closeTmpConnection(location, tmpLoc, tmpCon)
    })
    delete tmpDBConnections[location]
  }
  const readOnlyConnection = readonlyDBConnections[location]
  if (await readOnlyConnection) {
    await closeConnection(location, readOnlyConnection, readonlyDBConnections)
  }
  const roConnectionsPerMap = readonlyDBConnectionsPerRemoteMap[location]
  if (roConnectionsPerMap) {
    await awu(Object.values(roConnectionsPerMap)).forEach(async conn => {
      await closeDanglingConnection(conn)
    })
    delete readonlyDBConnectionsPerRemoteMap[location]
    log.debug('closed read-only connections per remote map of location %s', location)
  }
  const locationResources = remoteMapLocations.get(location)
  locationResources.counters.dump()
  remoteMapLocations.return(locationResources)
}

export const closeAllRemoteMaps = async (): Promise<void> => {
  const allLocations = uniq([
    ...Object.keys(persistentDBConnections),
    ...Object.keys(readonlyDBConnections),
    ...Object.keys(tmpDBConnections),
    ...Object.keys(readonlyDBConnectionsPerRemoteMap),
  ])
  await awu(allLocations).forEach(async loc => {
    await closeRemoteMapsOfLocation(loc)
  })
}

const cleanTmpDatabases = async (loc: string, ignoreErrors = false): Promise<void> => {
  const tmpDir = getDBTmpDir(loc)
  await awu(await fileUtils.readDir(tmpDir)).forEach(async tmpLoc => {
    try {
      log.debug('cleaning tmp db %s', tmpLoc)
      await deleteLocation(path.join(tmpDir, tmpLoc))
    } catch (e) {
      if (isDBLockErr(e as Error)) {
        log.debug('caught a rocksdb lock error while cleaning tmp db: %s', (e as Error).message)
      } else {
        log.warn('caught an unexpected error while cleaning tmp db: %s', (e as Error).message)
      }

      if (!ignoreErrors) {
        throw isDBLockErr(e as Error) ? new DBLockError() : e
      }
    }
  })
  if (_.isEmpty(tmpDBConnections[loc])) {
    delete tmpDBConnections[loc]
  }
}
export const cleanDatabases = async (): Promise<void> => {
  const persistentDBs = Object.entries(persistentDBConnections)
  await closeAllRemoteMaps()
  await awu(persistentDBs).forEach(async ([loc]) => {
    await cleanTmpDatabases(loc)
    return deleteLocation(loc)
  })
}

export const replicateDB = async (
  srcDbLocation: string, dstDbLocation: string, backupDir: string
): Promise<void> => {
  const remoteDbImpl = getRemoteDbImpl()
  await promisify(
    remoteDbImpl.replicate.bind(remoteDbImpl, srcDbLocation, dstDbLocation, backupDir)
  )()
}

const creatorLock = new AsyncLock()
const withCreatorLock = async (fn: (() => Promise<void>)): Promise<void> => {
  await creatorLock.acquire('createInProgress', fn)
}

const getOpenDBConnection = async (
  loc: string,
  isReadOnly: boolean
): Promise<rocksdb> => {
  log.debug('opening connection to %s, read-only=%s', loc, isReadOnly)
  if (currentConnectionsCount >= MAX_CONNECTIONS) {
    throw new Error(`Failed to open rocksdb connection - too many open connections already (${currentConnectionsCount} connections)`)
  }
  const newDb = getRemoteDbImpl()(loc)
  await promisify(newDb.open.bind(newDb, { readOnly: isReadOnly }))()
  currentConnectionsCount += 1
  return newDb
}

const getKeyPrefix = (namespace: string): string =>
  namespace.concat(NAMESPACE_SEPARATOR)

const getFullDBKey = (namespace: string, key: string): string =>
  getKeyPrefix(namespace).concat(key)

const getPrefixEndCondition = (prefix: string): string => prefix
  .substring(0, prefix.length - 1).concat((String
    .fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)))

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

const createIterator = (prefix: string, opts: CreateIteratorOpts, connection: rocksdb):
ReadIterator => {
  // Cannot use inner limit when filtering because if we filter anything out we will need
  // to get additional results from the inner iterator
  const limit = opts.filter === undefined ? opts.first : undefined
  const connectionIterator = connection.iterator({
    keys: opts.keys,
    values: opts.values,
    lte: getPrefixEndCondition(prefix),
    ...(opts.after !== undefined ? { gt: opts.after } : { gte: prefix }),
    ...(limit !== undefined ? { limit } : {}),
  })
  return opts.filter === undefined
    ? createReadIterator(connectionIterator)
    : createFilteredReadIterator(connectionIterator, opts.filter, opts.first)
}

export const createRemoteMapCreator = (location: string,
  persistentDefaultValue = false):
remoteMap.RemoteMapCreator => {
  const { counters: statCounters, cache: locationCache } = remoteMapLocations.get(location)

  let persistentDB: rocksdb
  let tmpDB: rocksdb
  return async <T, K extends string = string>(
    { namespace,
      batchInterval = 1000,
      persistent = persistentDefaultValue,
      serialize,
      deserialize }:
    remoteMap.CreateRemoteMapParams<T>
  ): Promise<remoteMap.RemoteMap<T, K> > => {
    let wasClearCalled = false
    const delKeys = new Set<string>()
    const locationTmpDir = getDBTmpDir(location)
    if (!await fileUtils.exists(location)) {
      await fileUtils.mkdirp(location)
    }
    if (!await fileUtils.exists(locationTmpDir)) {
      await fileUtils.mkdirp(locationTmpDir)
    }
    if (/:/i.test(namespace)) {
      throw new Error(
        `Invalid namespace: ${namespace}. Should not include the character ':'`
      )
    }

    const uniqueId = uuidv4()
    const tmpLocation = path.join(locationTmpDir, uniqueId)
    const keyPrefix = getKeyPrefix(namespace)
    const tempKeyPrefix = TEMP_PREFIX.concat(UNIQUE_ID_SEPARATOR, uniqueId, UNIQUE_ID_SEPARATOR,
      keyPrefix)
    const keyToDBKey = (key: string): string => getFullDBKey(namespace, key)
    const keyToTempDBKey = (key: string): string => tempKeyPrefix.concat(key)
    // We calculate a different key according to whether we're
    // looking for a temp value or a regular value
    const getAppropriateKey = (key: string, temp = false): string =>
      (temp ? keyToTempDBKey(key) : keyToDBKey(key))

    const createTempIterator = (opts: CreateIteratorOpts): ReadIterator => {
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

    const createPersistentIterator = (opts: CreateIteratorOpts): ReadIterator => {
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

    const getDataIterable = (opts: CreateIteratorOpts):
      AsyncIterable<remoteMap.RemoteMapEntry<string>> => (
      awu(aggregatedIterable(wasClearCalled
        ? [createTempIterator(opts)]
        : [createTempIterator(opts), createPersistentIterator(opts)]))
        .filter(entry => !delKeys.has(entry.key))
    )

    const getDataIterableWithPages = (opts: CreateIteratorOpts):
      AsyncIterable<remoteMap.RemoteMapEntry<string>[]> => (
      awu(aggregatedIterablesWithPages(
        wasClearCalled
          ? [createTempIterator(opts)]
          : [createTempIterator(opts), createPersistentIterator(opts)],
        opts.pageSize,
      )).map(async entries =>
        entries.filter(entry => !delKeys.has(entry.key)))
    )

    const setAllImpl = async (
      elementsEntries: AsyncIterable<remoteMap.RemoteMapEntry<T, K>>,
      temp = true,
    ): Promise<void> => {
      const batchInsertIterator = awu(elementsEntries).map(async entry => {
        delKeys.delete(entry.key)
        locationCache.set(keyToTempDBKey(entry.key), entry.value)
        return { key: entry.key, value: await serialize(entry.value) }
      })
      await batchUpdate(batchInsertIterator, temp)
    }
    const deserializeEntryValue = async (
      { key, value }: remoteMap.RemoteMapEntry<string>
    ): Promise<remoteMap.RemoteMapEntry<T, K>> => {
      const cacheKey = keyToTempDBKey(key)
      const cacheValue = locationCache.get(cacheKey) as T | undefined
      if (cacheValue !== undefined) {
        statCounters.LocationCacheHit.inc()
        return { key: key as K, value: cacheValue }
      }
      statCounters.LocationCacheMiss.inc()
      const deserializedValue = await deserialize(value)
      // We currently do not set the value back on the cache because in a large enough
      // map this will be a waste of memory (subsequent iterations won't benefit)
      return { key: key as K, value: deserializedValue }
    }
    const entriesImpl = (
      iterationOpts?: remoteMap.IterationOpts,
    ): AsyncIterable<remoteMap.RemoteMapEntry<T, K>> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      return awu(getDataIterable(opts)).map(deserializeEntryValue)
    }
    const entriesPagesImpl = (
      iterationOpts?: remoteMap.IterationOpts,
    ): AsyncIterable<remoteMap.RemoteMapEntry<T, K>[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      return awu(getDataIterableWithPages(opts)).map(entries => Promise.all(entries.map(deserializeEntryValue)))
    }
    const valuesImpl = (iterationOpts?: remoteMap.IterationOpts): AsyncIterable<T> => (
      awu(entriesImpl(iterationOpts)).map(entry => entry.value)
    )
    const valuesPagesImpl = (iterationOpts?: remoteMap.IterationOpts): AsyncIterable<T[]> => (
      awu(entriesPagesImpl(iterationOpts)).map(entries => entries.map(entry => entry.value))
    )
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
      return awu(getDataIterable(opts)).map(entry => entry.key as K)
    }
    const keysPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<K[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
      return awu(getDataIterableWithPages(opts)).map(entries => entries.map(entry => entry.key as K))
    }
    const getImpl = (key: string): Promise<T | undefined> => new Promise(resolve => {
      if (delKeys.has(key)) {
        resolve(undefined)
        return
      }
      if (locationCache.has(keyToTempDBKey(key))) {
        statCounters.LocationCacheHit.inc()
        statCounters.RemoteMapHit.inc()
        resolve(locationCache.get(keyToTempDBKey(key)) as T)
        return
      }
      statCounters.LocationCacheMiss.inc()
      const resolveRet = async (value: Buffer | string): Promise<void> => {
        const ret = (await deserialize(value.toString()))
        locationCache.set(keyToTempDBKey(key), ret)
        resolve(ret)
      }
      tmpDB.get(keyToTempDBKey(key), async (error, value) => {
        if (error) {
          if (wasClearCalled) {
            statCounters.RemoteMapMiss.inc()
            resolve(undefined)
            return
          }
          persistentDB.get(keyToDBKey(key), async (innerError, innerValue) => {
            if (innerError) {
              statCounters.RemoteMapMiss.inc()
              resolve(undefined)
              return
            }
            await resolveRet(innerValue)
            statCounters.RemoteMapHit.inc()
          })
        } else {
          await resolveRet(value)
          statCounters.RemoteMapHit.inc()
        }
      })
    })
    const deleteImpl = async (key: string): Promise<void> => {
      delKeys.add(key)
      locationCache.del(key)
    }
    const createDBIfNotExist = async (loc: string): Promise<void> => {
      const newDb: rocksdb = getRemoteDbImpl()(loc)
      const readOnly = !persistent
      try {
        await promisify(newDb.open.bind(newDb, { readOnly }))()
        await promisify(newDb.close.bind(newDb))()
      } catch (e) {
        if (newDb.status === 'new' && readOnly) {
          log.info('DB does not exist. Creating on %s', loc)
          try {
            await promisify(newDb.open.bind(newDb))()
            await promisify(newDb.close.bind(newDb))()
          } catch (err) {
            throw new Error(`Failed to open DB in write mode - ${loc}. Error: ${err}`)
          }
        } else {
          throw e
        }
      }
    }
    const createDBConnections = async (): Promise<void> => {
      if (tmpDB === undefined) {
        const tmpConnection = getOpenDBConnection(tmpLocation, false)
        tmpDB = await tmpConnection
        tmpDBConnections[location] = tmpDBConnections[location] ?? {}
        tmpDBConnections[location][tmpLocation] = tmpConnection
      } else {
        statCounters.TmpDbConnectionReuse.inc()
      }
      const mainDBConnections = persistent ? persistentDBConnections : readonlyDBConnections
      if (location in mainDBConnections) {
        statCounters.PersistentDbConnectionReuse.inc()
        persistentDB = await mainDBConnections[location]
        return
      }
      const connectionPromise = (async () => {
        try {
          if (persistent) {
            await cleanTmpDatabases(location, true)
          }
          const readOnly = !persistent
          if (readOnly) {
            await createDBIfNotExist(location)
          }
          statCounters.PersistentDbConnectionCreated.inc()
          return await getOpenDBConnection(location, readOnly)
        } catch (e) {
          if (isDBLockErr(e as Error)) {
            throw new DBLockError()
          }
          throw e
        }
      })()
      persistentDB = await connectionPromise
      mainDBConnections[location] = connectionPromise
    }
    log.debug('creating remote map for loc: %s, namespace: %s', location, namespace)
    await withCreatorLock(createDBConnections)
    statCounters.RemoteMapCreated.inc()
    return {
      get: getImpl,
      getMany: async (keys: string[]): Promise<(T | undefined)[]> =>
        withLimitedConcurrency(keys.map(k => () => getImpl(k)), GET_CONCURRENCY),
      values: <Opts extends remoteMap.IterationOpts>(iterationOpts?: Opts) => {
        if (iterationOpts && remoteMap.isPagedIterationOpts(iterationOpts)) {
          return valuesPagesImpl(iterationOpts) as remoteMap.RemoteMapIterator<T, Opts>
        }
        return valuesImpl(iterationOpts)
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
        await promisify(tmpDB.put.bind(tmpDB))(keyToTempDBKey(key), await serialize(element))
      },
      setAll: setAllImpl,
      deleteAll: async (iterator: AsyncIterable<K>) => awu(iterator).forEach(deleteImpl),
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

        if (wasClearCalled) {
          await clearImpl(persistentDB, keyPrefix)
        }

        const writeRes = await batchUpdate(awu(aggregatedIterable(
          [createTempIterator({ keys: true, values: true })]
        )), false)
        await clearImpl(tmpDB, tempKeyPrefix)
        const deleteRes = await batchUpdate(
          awu(delKeys.keys()).map(async key => ({ key, value: key })),
          false,
          DELETE_OPERATION
        )
        log.debug('flushed %s. results %o', namespace, { writeRes, deleteRes, wasClearCalled })
        const flushRes = writeRes || deleteRes || wasClearCalled
        wasClearCalled = false
        return flushRes
      },
      revert: async () => {
        locationCache.reset()
        delKeys.clear()
        wasClearCalled = false
        await clearImpl(tmpDB, tempKeyPrefix)
      },
      clear: async () => {
        locationCache.reset()
        await clearImpl(tmpDB, tempKeyPrefix)
        wasClearCalled = true
      },
      delete: deleteImpl,
      has: async (key: string): Promise<boolean> => {
        if (locationCache.has(keyToTempDBKey(key))) {
          return true
        }
        const hasKeyImpl = async (k: string, db: rocksdb): Promise<boolean> =>
          new Promise(resolve => {
            db.get(k, async (error, value) => {
              resolve(!error && value !== undefined)
            })
          })
        return (await hasKeyImpl(keyToTempDBKey(key), tmpDB))
          || (!wasClearCalled && hasKeyImpl(keyToDBKey(key), persistentDB))
      },
      close: async (): Promise<void> => {
        // Do nothing - we can not close the connection here
        //  because we share the connection across multiple namespaces
        log.warn(
          'cannot close connection of remote map with close method - use closeRemoteMapsOfLocation'
        )
      },
      isEmpty: async (): Promise<boolean> => awu(keysImpl({ first: 1 })).isEmpty(),
    }
  }
}

export const createReadOnlyRemoteMapCreator = (location: string):
remoteMap.ReadOnlyRemoteMapCreator => {
  const notImplemented = (opName: string): void => {
    throw new Error(`${opName} is invalid operation on read only remote map`)
  }
  let db: rocksdb
  return async <T, K extends string = string>({
    namespace, deserialize,
  }: remoteMap.CreateReadOnlyRemoteMapParams<T>): Promise<remoteMap.RemoteMap<T, K> > => {
    const uniqueId = uuidv4()
    const keyToDBKey = (key: string): string => getFullDBKey(namespace, key)
    const keyPrefix = getKeyPrefix(namespace)
    const createDBIterator = (opts: CreateIteratorOpts): ReadIterator => {
      const normalizedOpts = {
        ...opts,
        ...(opts.after ? { after: keyToDBKey(opts.after) } : {}),
      }
      return createIterator(keyPrefix, normalizedOpts, db)
    }
    const createDBConnection = async (): Promise<void> => {
      readonlyDBConnectionsPerRemoteMap[location] = readonlyDBConnectionsPerRemoteMap[location]
        ?? {}
      const connectionPromise = (async () => getOpenDBConnection(location, true))()
      db = await connectionPromise
      readonlyDBConnectionsPerRemoteMap[location][uniqueId] = connectionPromise
    }
    const keysImpl = (iterationOpts?: remoteMap.IterationOpts): AsyncIterable<K> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
      const keyIter = createDBIterator(opts)
      return awu(aggregatedIterable([keyIter]))
        .map(async (entry: remoteMap.RemoteMapEntry<string>) => entry.key as K)
    }
    const keysPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<K[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
      const keyIter = createDBIterator(opts)
      return awu(aggregatedIterablesWithPages([keyIter], opts.pageSize))
        .map(async entries => entries.map(entry => entry.key as K))
    }
    const getImpl = (key: string): Promise<T | undefined> => new Promise(resolve => {
      const resolveRet = async (value: Buffer | string): Promise<void> => {
        resolve(await deserialize(value.toString()))
      }
      db.get(keyToDBKey(key), async (error, value) => {
        if (error) {
          resolve(undefined)
        } else {
          await resolveRet(value)
        }
      })
    })
    const valuesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<T> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const iter = createDBIterator(opts)
      return awu(aggregatedIterable([iter]))
        .map(async entry => deserialize(entry.value))
    }
    const valuesPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<T[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const iter = createDBIterator(opts)
      return awu(aggregatedIterablesWithPages([iter], opts.pageSize))
        .map(async entries => Promise.all(entries.map(entry => deserialize(entry.value))))
    }
    const entriesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<remoteMap.RemoteMapEntry<T, K>> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const iter = createDBIterator(opts)
      return awu(aggregatedIterable([iter]))
        .map(
          async entry => ({ key: entry.key as K, value: await deserialize(entry.value) })
        )
    }
    const entriesPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<remoteMap.RemoteMapEntry<T, K>[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      const iter = createDBIterator(opts)
      return awu(aggregatedIterablesWithPages([iter], opts.pageSize))
        .map(entries => Promise.all(
          entries
            .map(
              async entry => ({ key: entry.key as K, value: await deserialize(entry.value) })
            )
        ))
    }
    const closeImpl = async (): Promise<void> => {
      await closeDanglingConnection(Promise.resolve(db))
      delete readonlyDBConnectionsPerRemoteMap[location][uniqueId]
    }
    await createDBConnection()
    return {
      get: getImpl,
      getMany: async (keys: string[]): Promise<(T | undefined)[]> =>
        withLimitedConcurrency(keys.map(k => () => getImpl(k)), GET_CONCURRENCY),
      values: <Opts extends remoteMap.IterationOpts>(iterationOpts?: Opts) => {
        if (iterationOpts && remoteMap.isPagedIterationOpts(iterationOpts)) {
          return valuesPagesImpl(iterationOpts) as remoteMap.RemoteMapIterator<T, Opts>
        }
        return valuesImpl(iterationOpts)
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
      set: async (_key: string, _element: T): Promise<void> => { notImplemented('set') },
      setAll: async (
        _entries: AsyncIterable<remoteMap.RemoteMapEntry<T, K>>, _temp = true
      ): Promise<void> => { notImplemented('setAll') },
      deleteAll: async (_iterator: AsyncIterable<K>) => { notImplemented('deleteAll') },
      keys: <Opts extends remoteMap.IterationOpts>(
        iterationOpts?: Opts
      ): remoteMap.RemoteMapIterator<K, Opts> => {
        if (iterationOpts && remoteMap.isPagedIterationOpts(iterationOpts)) {
          return keysPagesImpl(iterationOpts) as remoteMap.RemoteMapIterator<K, Opts>
        }
        return keysImpl(iterationOpts) as remoteMap.RemoteMapIterator<K, Opts>
      },
      flush: async () => {
        notImplemented('flush')
        return false
      },
      revert: async () => { notImplemented('revert') },
      clear: async () => { notImplemented('clear') },
      delete: async (_key: string) => { notImplemented('delete') },
      has: async (key: string): Promise<boolean> => new Promise(resolve => {
        db.get(keyToDBKey(key), async (error, value) => {
          resolve(!error && value !== undefined)
        })
      }),
      close: closeImpl,
      isEmpty: async (): Promise<boolean> => awu(keysImpl({ first: 1 })).isEmpty(),
    }
  }
}
