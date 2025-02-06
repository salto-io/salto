/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { remoteMap as rm } from '@salto-io/workspace'
import {
  createRemoteMapCreator,
  createReadOnlyRemoteMap,
  MAX_CONNECTIONS,
  closeAllRemoteMaps,
} from '../../src/remote_map/remote_map'
import { remoteMapLocations } from '../../src/remote_map/location_pool'

describe('connection creation', () => {
  const DB_LOCATION = '/tmp/test_db'
  const mockOpen = jest.fn().mockImplementation((_opts, cb) => {
    cb()
  })
  const mockClose = jest.fn().mockImplementation(cb => {
    cb()
  })
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const mockedRocksdb = () => ({
      open: mockOpen,
      close: mockClose,
      status: 'open',
    })
    mockedRocksdb.destroy = jest.fn().mockImplementation((_loc, cb) => {
      cb()
    })
    jest.mock('../../src/remote_map/rocksdb', () => ({
      default: mockedRocksdb,
    }))
  })
  afterEach(async () => {
    await closeAllRemoteMaps()
    jest.clearAllMocks()
  })
  describe('createRemoteMapCreator', () => {
    const createMap = async (
      namespace: string,
      persistent = true,
    ): Promise<{ remoteMap: rm.RemoteMap<string>; close: () => Promise<void> }> => {
      const { create, close } = createRemoteMapCreator(DB_LOCATION)
      return {
        close,
        remoteMap: await create({
          namespace,
          batchInterval: 1000,
          serialize: async str => str,
          deserialize: async str => Promise.resolve(str),
          persistent,
        }),
      }
    }
    it('should create a single persistent db connection for a location', async () => {
      await Promise.all([createMap('integration'), createMap('integration')])
      const mockCalls = mockOpen.mock.calls
      const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
      const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
      // 0 for the creation, 2 tmp connections and 1 (persistent) db connection,
      // 0 load time destroys attempts
      expect(writeCalls).toHaveLength(3)
      expect(readOnlyCalls).toHaveLength(0)
    })
    it('should try to open with read only mode if remote map is not persistent', async () => {
      await Promise.all([createMap('integration', false), createMap('integration', false)])
      const mockCalls = mockOpen.mock.calls
      const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
      const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
      // 1 for the creation and 1 db connection
      expect(readOnlyCalls).toHaveLength(2)
      // 2 tmp connections
      expect(writeCalls).toHaveLength(2)
    })
    describe('close', () => {
      let cacheReturnSpy: jest.SpyInstance
      beforeEach(() => {
        cacheReturnSpy = jest.spyOn(remoteMapLocations, 'return')
      })
      describe('with a location that was opened as persistent', () => {
        beforeEach(async () => {
          const { close } = await createMap('bla', true)
          await close()
        })
        it('should close the connections to the main and tmp DBs', () => {
          expect(mockClose).toHaveBeenCalledTimes(2)
        })
        it('should return the cache of the location', () => {
          expect(cacheReturnSpy).toHaveBeenCalledWith(DB_LOCATION)
        })
      })
      describe('with a location that was opened as persistent=false', () => {
        beforeEach(async () => {
          const { close } = await createMap('bla', false)
          await close()
        })
        it('should close the additional connections to the readonly and tmp DBs', () => {
          // 1 for the createDBIfNotExist that happens on createMap init when persistent=false
          // 1 for closing readonly db
          // 1 for closing temp dbs
          expect(mockClose).toHaveBeenCalledTimes(3)
        })
        it('should return the cache of the location', () => {
          expect(cacheReturnSpy).toHaveBeenCalledWith(DB_LOCATION)
        })
      })
    })
  })
  describe('createReadOnlyRemoteMap', () => {
    const createMap = async (location: string, namespace: string): Promise<rm.RemoteMap<string>> =>
      createReadOnlyRemoteMap({ location, namespace, deserialize: async str => str })
    it('should open db successfully if the db does exist', async () => {
      await Promise.all([createMap(DB_LOCATION, 'integration'), createMap(DB_LOCATION, 'integration')])
      const mockCalls = mockOpen.mock.calls
      const writeCalls = mockCalls.filter(args => args[0].readOnly === false)
      const readOnlyCalls = mockCalls.filter(args => args[0].readOnly === true)
      // 1 for each connections - no connection caching in ReadOnlyRemoteMap
      expect(readOnlyCalls).toHaveLength(2)
      expect(writeCalls).toHaveLength(0)
    })
    it('should throw exception if db does not exist', async () => {
      mockOpen.mockImplementationOnce((_opts, _cb) => {
        throw new Error('err')
      })
      await expect(createMap(DB_LOCATION, 'integration')).rejects.toThrow('err')
    })
  })
  describe('connection cache limits', () => {
    describe('when opening many connections', () => {
      const createMap = async (location: string): Promise<rm.RemoteMap<string>> =>
        createRemoteMapCreator(location).create({
          namespace: 'namespace',
          batchInterval: 1000,
          serialize: async str => str,
          deserialize: async str => Promise.resolve(str),
          persistent: true,
        })
      const createReadOnlyMap = async (location: string): Promise<rm.RemoteMap<string>> =>
        createReadOnlyRemoteMap({ location, namespace: 'namespace', deserialize: async str => str })
      it('should correctly count when openning different db', async () => {
        // We open two connections each time
        await Promise.all(
          _.times(MAX_CONNECTIONS / 2, async idx => {
            await createMap(`${DB_LOCATION}/${idx}`)
          }),
        )

        await expect(createMap(`${DB_LOCATION}/tooMany`)).rejects.toThrow('too many open connections')
      })
      it('should correctly count when openning the same DB', async () => {
        // We open the main connections once, and tmp connection each time
        await Promise.all(
          _.times(MAX_CONNECTIONS - 1, async () => {
            await createMap(DB_LOCATION)
          }),
        )

        await expect(createMap(DB_LOCATION)).rejects.toThrow('too many open connections')
      })
      it('should correcly count read only db connections', async () => {
        // One connection per db
        await Promise.all(
          _.times(MAX_CONNECTIONS, async () => {
            await createReadOnlyMap(DB_LOCATION)
          }),
        )

        await expect(createReadOnlyMap(DB_LOCATION)).rejects.toThrow('too many open connections')
      })
      it('should decrease the count when closing RO connections', async () => {
        const maps: rm.RemoteMap<string>[] = []
        // One connection per db
        await Promise.all(
          _.times(MAX_CONNECTIONS, async () => {
            maps.push(await createReadOnlyMap(DB_LOCATION))
          }),
        )

        await maps[0].close()
        await createReadOnlyMap(DB_LOCATION)

        await expect(createReadOnlyMap(DB_LOCATION)).rejects.toThrow('too many open connections')
      })
      it('should count together RO & RW connections', async () => {
        // One connection per db
        await Promise.all(
          _.times(MAX_CONNECTIONS, async () => {
            await createReadOnlyMap(DB_LOCATION)
          }),
        )

        await expect(createMap(DB_LOCATION)).rejects.toThrow('too many open connections')
      })
    })
  })
})
