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
import _ from 'lodash'
import path from 'path'
import AsyncLock from 'async-lock'
import { promisify } from 'util'
import { logger } from '@salto-io/logging'
import * as fileUtils from '@salto-io/file'
import rocksdb from '@salto-io/rocksdb'
import { collections } from '@salto-io/lowerdash'
import { counters, LocationCounters } from './counters'

const log = logger(module)
const { awu } = collections.asynciterable

export const TMP_DB_DIR = 'tmp-dbs'

export const MAX_CONNECTIONS = 1000
let currentConnectionsCount = 0

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rocksdbImpl: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getRemoteDbImpl = (): any => {
  if (rocksdbImpl === undefined) {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    rocksdbImpl = require('./rocksdb').default
  }
  return rocksdbImpl
}

export const closeDanglingConnection = async (connection: Promise<rocksdb>): Promise<void> => {
  const dbConnection = await connection
  if (dbConnection.status === 'open') {
    await promisify(dbConnection.close.bind(dbConnection))()
    currentConnectionsCount -= 1
  }
}

export const getOpenReadOnlyDBConnection = async (
  loc: string
): Promise<rocksdb> => {
  log.debug('opening read-only connection to %s', loc)
  if (currentConnectionsCount >= MAX_CONNECTIONS) {
    throw new Error(`Failed to open rocksdb connection - too many open connections already (${currentConnectionsCount} connections)`)
  }
  const newDb = getRemoteDbImpl()(loc)
  await promisify(newDb.open.bind(newDb, { readOnly: true }))()
  currentConnectionsCount += 1
  return newDb
}

const isDBLockErr = (error: Error): boolean =>
  error.message.includes('LOCK: Resource temporarily unavailable')
  || error.message.includes('lock hold by current process')
  || error.message.includes('LOCK: The process cannot access the file because it is being used by another process')

class DBLockError extends Error {
  constructor() {
    super('Salto local database locked. Could another Salto process '
      + 'or a process using Salto be open?')
  }
}

export const getDBTmpDir = (location: string): string => path.join(location, TMP_DB_DIR)

const isDBNotExistErr = (error: Error): boolean => (
  error.message.includes('LOCK: No such file or directory')
)

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


const createDBIfNotExist = async (loc: string, persistent: boolean): Promise<void> => {
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


type DbType = 'main-persistent' | 'main-ephemeral' | 'temporary'
export type DbAttributes = {
  location: string
  type: DbType
}
export type DbConnection = {
  dbConn: rocksdb
  attributes: DbAttributes
}
const createDbConnection = async (attributes: DbAttributes, readonly: boolean): Promise<DbConnection> => {
  const openRocksDBConnection = async (loc: string, isReadOnly: boolean): Promise<rocksdb> => {
    log.debug('opening connection to %s, read-only=%s', loc, isReadOnly)
    if (currentConnectionsCount >= MAX_CONNECTIONS) {
      throw new Error(`Failed to open rocksdb connection - too many open connections already (${currentConnectionsCount} connections)`)
    }
    const newDb = getRemoteDbImpl()(loc)
    await promisify(newDb.open.bind(newDb, { readOnly: isReadOnly }))()
    currentConnectionsCount += 1
    return newDb
  }

  return {
    dbConn: await openRocksDBConnection(attributes.location, readonly),
    attributes,
  }
}
type DBConnectionPool = {
  get: (attributes: DbAttributes) => Promise<DbConnection>
  put: (connection: DbConnection) => Promise<void>
  destroyAll: () => Promise<void>

  // These methods are temporary to allow the implementation of closeRemoteMapsOfLocation.
  // Once we remove closeRemoteMapOfLocation, these methods should be removed.
  primaryDbLocations: () => string[]
  putAll: (location: string, type?: DbType) => Promise<void>
  // ---
}
const createDBConnectionPool = (): DBConnectionPool => {
  const poolLock = new AsyncLock()
  const withPoolLock = async (fn: (() => Promise<void>)): Promise<void> => {
    await poolLock.acquire('poolModificationInProgress', fn)
  }
  const discoverAllTmpDbs = async (dbLocation: string): Promise<string[]> => {
    const tmpDir = getDBTmpDir(dbLocation)
    return fileUtils.readDir(tmpDir)
  }
  const deleteDb = async (dbDir: string, force?: boolean): Promise<void> => {
    try {
      log.debug('cleaning db %s', dbDir)
      await deleteLocation(dbDir)
    } catch (e) {
      if (isDBLockErr(e)) {
        log.debug('caught a rocksdb lock error while cleaning tmp db: %s', e.message)
      } else {
        log.warn('caught an unexpected error while cleaning tmp db: %s', e.message)
      }

      if (!force) {
        throw isDBLockErr(e) ? new DBLockError() : e
      }
    }
  }

  const deleteAllTmpDBs = async (location: string, force?: boolean): Promise<void> => {
    await awu(await discoverAllTmpDbs(location))
      .forEach(async tmpDbDir => deleteDb(path.join(getDBTmpDir(location), tmpDbDir), force))
  }

  const prepareAndOpenDB = async ({ location, type }: DbAttributes): Promise<DbConnection> => {
    try {
      log.debug('Creating %s DB at %s', type, location)
      switch (type) {
        case 'main-persistent':
          // Make sure there are no leftovers from previous runs
          await deleteAllTmpDBs(location, true)
          break
        case 'main-ephemeral':
          // This is an ephemeral DB, so we create a new one every time we need one
          await createDBIfNotExist(location, false)
          break
        case 'temporary':
          break
        default:
          throw new Error('Unexpected DB type')
      }

      const readOnly = (type === 'main-ephemeral')
      return await createDbConnection({ location, type }, readOnly)
    } catch (e) {
      if (isDBLockErr(e)) {
        throw new DBLockError()
      }
      throw e
    }
  }

  type PoolEntry = { conn: DbConnection; refcnt: number }
  const pool: Record<string, PoolEntry> = {}
  const primaryDbLocations: string[] = []

  const connectionKey = (attributes: DbAttributes): string => (
    `${attributes.type}@@${attributes.location}`
  )
  const getPoolEntry = (attributes: DbAttributes): PoolEntry | undefined => (
    pool[connectionKey(attributes)]
  )
  const newPoolEntry = (attributes: DbAttributes, connection: DbConnection): void => {
    pool[connectionKey(attributes)] = { conn: connection, refcnt: 0 }
  }
  const deletePoolEntry = (attributes: DbAttributes): void => {
    delete pool[connectionKey(attributes)]
  }
  const createPoolEntryIfNeeded = async (attributes : DbAttributes, statCounters: LocationCounters): Promise<void> => {
    const poolEntry = getPoolEntry(attributes)
    if (poolEntry !== undefined) {
      if (attributes.type === 'temporary') {
        log.warn('Two temporary DBs are sharing the same location')
      }
      statCounters.PersistentDbConnectionReuse.inc()
      return
    }

    const conn = await prepareAndOpenDB(attributes)
    newPoolEntry(attributes, conn)
    if (attributes.type !== 'temporary') {
      primaryDbLocations.push(attributes.location)
    }
    statCounters.PersistentDbConnectionCreated.inc()
  }
  const putImpl = async ({ attributes }: DbConnection): Promise<void> => {
    const poolEntry = getPoolEntry(attributes)
    if (!poolEntry) {
      throw new Error('Closing a DB connection that was never opened')
    }
    poolEntry.refcnt -= 1
    if (poolEntry.refcnt === 0) {
      await closeDanglingConnection(Promise.resolve(poolEntry.conn.dbConn))
      if (attributes.type === 'temporary') {
        await deleteDb(poolEntry.conn.attributes.location)
      } else {
        _.pull(primaryDbLocations, attributes.location)
      }
      deletePoolEntry(attributes)
    }
  }
  return {
    get: async attributes => {
      const statCounters = counters.get(attributes.location)
      await withPoolLock(async () => createPoolEntryIfNeeded(attributes, statCounters))
      const poolEntry = getPoolEntry(attributes)
      if (poolEntry === undefined) {
        throw new Error('Unable to create DB connection')
      }
      counters.return(attributes.location)
      poolEntry.refcnt += 1
      return poolEntry.conn
    },
    put: putImpl,
    destroyAll: async () => {
      if (pool.size) {
        log.error('Destroying DBs without closing all connections')
      }
      await awu(primaryDbLocations)
        .forEach(location => deleteAllTmpDBs(location))

      await awu(primaryDbLocations)
        .forEach(primaryDbDir => deleteDb(primaryDbDir))

      primaryDbLocations.length = 0
    },
    primaryDbLocations: (): string[] => (
      primaryDbLocations
    ),
    putAll: async (locationToClose, dbType?) => {
      const removeFromPool = async (conn: DbConnection): Promise<void> => {
        const poolEntry = getPoolEntry(conn.attributes)
        if (!poolEntry) {
          return
        }
        poolEntry.refcnt = 1
        await putImpl(conn)
      }

      await Promise.all(
        Object.values(pool)
          .filter(({ conn }) => (conn.attributes.location.startsWith(locationToClose)))
          .filter(({ conn }) => (!dbType || conn.attributes.type === dbType))
          .map(({ conn }) => removeFromPool(conn)),
      )
    },
  }
}
export const dbConnectionPool = createDBConnectionPool()
