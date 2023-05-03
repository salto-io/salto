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
import { collections, promises } from '@salto-io/lowerdash'
import type rocksdb from '@salto-io/rocksdb'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { remoteMapLocations } from './location_pool'
import {
  DELETE_OPERATION,
  GET_CONCURRENCY,
  NAMESPACE_SEPARATOR,
  SET_OPERATION,
  TEMP_PREFIX,
  UNIQUE_ID_SEPARATOR,
} from './constants'
import {
  aggregatedIterable,
  aggregatedIterablesWithPages,
  createIterator,
  CreateIteratorOpts,
  ReadIterator,
} from './db_iterator'

const { asynciterable } = collections
const { awu } = asynciterable
const { withLimitedConcurrency } = promises.array
const log = logger(module)

export const TMP_DB_DIR = 'tmp-dbs'

type ConnectionPool = Record<string, Promise<rocksdb>>

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
    if (!isDBNotExistErr(e)) {
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
      if (isDBLockErr(e)) {
        log.debug('caught a rocksdb lock error while cleaning tmp db: %s', e.message)
      } else {
        log.warn('caught an unexpected error while cleaning tmp db: %s', e.message)
      }

      if (!ignoreErrors) {
        throw isDBLockErr(e) ? new DBLockError() : e
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
        normalizedOpts,
        tmpDB,
        tempKeyPrefix,
        getPrefixEndCondition(tempKeyPrefix)
      )
    }

    const createPersistentIterator = (opts: CreateIteratorOpts): ReadIterator => {
      const normalizedOpts = {
        ...opts,
        ...(opts.after ? { after: keyToDBKey(opts.after) } : {}),
      }
      return createIterator(normalizedOpts, persistentDB, keyPrefix, getPrefixEndCondition(keyPrefix))
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

    const getDataIterable = (opts: CreateIteratorOpts, tempOnly = false):
      AsyncIterable<remoteMap.RemoteMapEntry<string>> => (
      awu(aggregatedIterable(tempOnly || wasClearCalled
        ? [createTempIterator(opts)]
        : [createTempIterator(opts), createPersistentIterator(opts)]))
        .filter(entry => !delKeys.has(entry.key))
    )

    const getDataIterableWithPages = (opts: CreateIteratorOpts, tempOnly = false):
      AsyncIterable<remoteMap.RemoteMapEntry<string>[]> => (
      awu(aggregatedIterablesWithPages(
        tempOnly || wasClearCalled
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
    const valuesImpl = (tempOnly = false, iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<T> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      return awu(getDataIterable(opts, tempOnly))
        .map(async entry => deserialize(entry.value))
    }
    const valuesPagesImpl = (tempOnly = false, iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<T[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      return awu(getDataIterableWithPages(opts, tempOnly))
        .map(async entries => Promise.all(
          entries.map(entry => deserialize(entry.value))
        ))
    }
    const entriesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<remoteMap.RemoteMapEntry<T, K>> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      return awu(getDataIterable(opts, false))
        .map(
          async entry => ({ key: entry.key as K, value: await deserialize(entry.value) })
        )
    }
    const entriesPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<remoteMap.RemoteMapEntry<T, K>[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: true }
      return awu(getDataIterableWithPages(opts, false))
        .map(entries => Promise.all(
          entries
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
      return awu(getDataIterable(opts, false))
        .map(async (entry: remoteMap.RemoteMapEntry<string>) => entry.key as K)
    }
    const keysPagesImpl = (iterationOpts?: remoteMap.IterationOpts):
    AsyncIterable<K[]> => {
      const opts = { ...(iterationOpts ?? {}), keys: true, values: false }
      return awu(getDataIterableWithPages(opts, false)).map(async entries =>
        entries.map(entry => entry.key as K))
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
          if (isDBLockErr(e)) {
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
      return createIterator(normalizedOpts, db, keyPrefix, getPrefixEndCondition(keyPrefix))
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
