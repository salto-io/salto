/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import * as remoteMap from '../../../src/workspace/remote_map'
import * as staticFiles from '../../../src/workspace/static_files'

const { DefaultMap } = collections.map
const { buildStaticFilesCache } = staticFiles

jest.mock('@salto-io/file')
describe('Static Files Cache', () => {
  let staticFilesCache: staticFiles.StaticFilesCache

  const baseMetaData = {
    hash: 'hashz',
    filepath: 'some/path.ext',
  }
  const expectedResult = {
    filepath: baseMetaData.filepath,
    hash: baseMetaData.hash,
    modified: 123,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('new cache', () => {
    let remoteMapCreator: jest.MockedFunction<remoteMap.RemoteMapCreator['create']>

    beforeEach(() => {
      // We keep a cache to simulate the fact that remote maps
      // with the same namespace point to the same entries.
      const remoteMaps = new DefaultMap(() => new remoteMap.InMemoryRemoteMap())
      remoteMapCreator = mockFunction<remoteMap.RemoteMapCreator['create']>().mockImplementation(async opts =>
        remoteMaps.get(opts.namespace),
      )
      staticFilesCache = buildStaticFilesCache('test-env', { create: remoteMapCreator, close: async () => {} }, true)
    })
    it('should handle unknown file paths', async () => {
      expect(await staticFilesCache.get(baseMetaData.filepath)).toBeUndefined()
    })
    it('puts and retrieves value', async () => {
      await staticFilesCache.put(expectedResult)
      expect(await staticFilesCache.get(baseMetaData.filepath)).toEqual(expectedResult)
    })
    it('put many files and retrieve them', async () => {
      const files = [1, 2, 3].map(i => ({
        filepath: `${expectedResult.filepath}.${i}`,
        hash: `${expectedResult.hash}${i}`,
        modified: expectedResult.modified + i,
      }))
      await staticFilesCache.putMany(files)
      expect(await staticFilesCache.get(files[0].filepath)).toEqual(files[0])
      expect(await staticFilesCache.get(files[1].filepath)).toEqual(files[1])
      expect(await staticFilesCache.get(files[2].filepath)).toEqual(files[2])
    })
    it('delete from cache', async () => {
      await staticFilesCache.put(expectedResult)
      await staticFilesCache.delete(baseMetaData.filepath)
      expect(await staticFilesCache.get(baseMetaData.filepath)).toBeUndefined()
    })
    it('delete many files from cahce', async () => {
      const files = [1, 2, 3].map(i => ({
        filepath: `${expectedResult.filepath}.${i}`,
        hash: `${expectedResult.hash}${i}`,
        modified: expectedResult.modified + i,
      }))
      await staticFilesCache.putMany(files)
      await staticFilesCache.deleteMany(files.map(f => f.filepath))
      expect(await staticFilesCache.get(files[0].filepath)).toBeUndefined()
      expect(await staticFilesCache.get(files[1].filepath)).toBeUndefined()
      expect(await staticFilesCache.get(files[2].filepath)).toBeUndefined()
    })
    it('clear', async () => {
      await staticFilesCache.put(expectedResult)
      await staticFilesCache.clear()
      expect(await staticFilesCache.get(baseMetaData.filepath)).toBeUndefined()
    })
    it('rename', async () => {
      await staticFilesCache.put(expectedResult)
      await staticFilesCache.rename('new-env')
      expect(remoteMapCreator).toHaveBeenCalledTimes(2)
      expect(remoteMapCreator).toHaveBeenLastCalledWith(
        expect.objectContaining({ namespace: 'staticFilesCache-new-env' }),
      )
      expect(await staticFilesCache.get(baseMetaData.filepath)).toEqual(expectedResult)
    })
    it('clone', async () => {
      await staticFilesCache.put(expectedResult)
      const cloned = staticFilesCache.clone()
      expect(await cloned.get(baseMetaData.filepath)).toEqual(expectedResult)
      expect(cloned).not.toBe(staticFilesCache)
    })
    it('list', async () => {
      const file1 = {
        filepath: 'file1.txt',
        hash: 'HASH',
        modified: 123,
      }
      const file2 = {
        filepath: 'file2.txt',
        hash: 'HASH',
        modified: 123,
      }
      await staticFilesCache.put(file1)
      await staticFilesCache.put(file2)
      expect(await staticFilesCache.list()).toEqual([file1.filepath, file2.filepath])
    })
  })

  describe('remote map options', () => {
    let remoteMapCreator: jest.MockedFunction<remoteMap.RemoteMapCreator['create']>
    beforeEach(() => {
      remoteMapCreator = mockFunction<remoteMap.RemoteMapCreator['create']>().mockImplementation(
        async () => new remoteMap.InMemoryRemoteMap(),
      )
    })

    it('should respect the persistent parameter', async () => {
      const cache = buildStaticFilesCache('test-env', { create: remoteMapCreator, close: async () => {} }, false)
      await cache.get('bla')
      expect(remoteMapCreator).toHaveBeenCalledTimes(1)
      expect(remoteMapCreator).toHaveBeenCalledWith(expect.objectContaining({ persistent: false }))
    })
  })
})
