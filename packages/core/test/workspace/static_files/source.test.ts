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
import { DirectoryStore } from '../../../src/workspace/dir_store'

import {
  StaticFilesSource, buildStaticFilesSource,
  STATIC_RESOURCES_FOLDER,
} from '../../../src/workspace/static_files/source'

import {
  InvalidStaticFile, StaticFileNaclValue,
} from '../../../src/workspace/static_files/common'


import {
  StaticFilesCache,
} from '../../../src/workspace/static_files/cache'


describe('Static Files Source', () => {
  const hashZOMG = '4dc55a74daa147a028360ee5687389d7'

  let staticFilesSource: StaticFilesSource
  let mockDirStore: DirectoryStore
  let mockCacheStore: StaticFilesCache
  beforeEach(() => {
    mockCacheStore = {
      get: jest.fn().mockResolvedValue(undefined),
      getByFile: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(Promise.resolve()),
      flush: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
      clone: () => mockCacheStore,
    } as StaticFilesCache
    mockDirStore = {
      list: () => Promise.resolve([]),
      get: jest.fn().mockResolvedValue(undefined),
      getFiles: jest.fn().mockResolvedValue([undefined]),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
      renameFile: () => Promise.resolve(),
      flush: () => Promise.resolve(),
      mtimestamp: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
      clone: () => mockDirStore,
    }
    staticFilesSource = buildStaticFilesSource(
      mockDirStore,
      mockCacheStore,
    )
  })
  describe('Get By Value', () => {
    describe('file finding logic', () => {
      it('not find when no matching', () =>
        expect(staticFilesSource.getMetaData(new StaticFileNaclValue('aa')))
          .resolves.toBeInstanceOf(InvalidStaticFile))
      it('find when matching', async () => {
        const filepathFromCache = 'filepathfromcache'
        mockDirStore.get = jest.fn().mockResolvedValue({
          buffer: 'ZOMG',
        })
        mockDirStore.mtimestamp = jest.fn(
          (filepath: string): Promise<number | undefined> =>
            Promise.resolve(
              filepath.endsWith(filepathFromCache)
                ? 1000
                : undefined
            )
        )
        mockCacheStore.get = jest.fn().mockResolvedValue({
          filepath: filepathFromCache,
          modified: 100,
          hash: 'aaa',
        })
        const result = await staticFilesSource.getMetaData(
          new StaticFileNaclValue(filepathFromCache)
        )

        expect(mockDirStore.mtimestamp).toHaveBeenCalledWith(`${STATIC_RESOURCES_FOLDER}/${filepathFromCache}`)
        return expect(result).toHaveProperty('hash', hashZOMG)
      })
    })
    describe('hashing', () => {
      it('should not hash if in cache and file not modified', async () => {
        const filepathFromCache = 'filepathfromcache'
        mockDirStore.get = jest.fn().mockResolvedValue(undefined)
        mockDirStore.mtimestamp = jest.fn(
          (filepath: string): Promise<number | undefined> =>
            Promise.resolve(
              filepath.endsWith('bb')
                ? 100
                : undefined
            )
        )
        mockCacheStore.get = jest.fn().mockResolvedValue({
          filepath: filepathFromCache,
          modified: 1000,
          hash: 'aaa',
        })
        const result = await staticFilesSource.getMetaData(new StaticFileNaclValue('bb'))
        expect(mockDirStore.get).toHaveBeenCalledTimes(0)
        return expect(result).toHaveProperty('hash', 'aaa')
      })
      it('should hash if in cache and file modified is newer', async () => {
        const filepathFromCache = 'filepathfromcache'
        mockDirStore.get = jest.fn().mockResolvedValue({
          buffer: 'ZOMG',
        })
        mockDirStore.mtimestamp = jest.fn(
          (filepath: string): Promise<number | undefined> =>
            Promise.resolve(
              filepath.endsWith('bb')
                ? 1000
                : undefined
            )
        )
        mockCacheStore.get = jest.fn().mockResolvedValue({
          filepath: filepathFromCache,
          modified: 100,
          hash: 'aaa',
        })
        const result = await staticFilesSource.getMetaData(new StaticFileNaclValue('bb'))
        expect(mockDirStore.get).toHaveBeenCalledTimes(1)
        return expect(result).toHaveProperty('hash', hashZOMG)
      })
      it('should hash if not cache', async () => {
        mockDirStore.get = jest.fn().mockResolvedValue({
          buffer: 'ZOMG',
        })
        mockDirStore.mtimestamp = jest.fn(
          (filepath: string): Promise<number | undefined> =>
            Promise.resolve(
              filepath.endsWith('bb')
                ? 1000
                : undefined
            )
        )
        mockCacheStore.get = jest.fn().mockResolvedValue(undefined)
        const result = await staticFilesSource.getMetaData(new StaticFileNaclValue('bb'))
        expect(mockDirStore.get).toHaveBeenCalledTimes(1)
        return expect(result).toHaveProperty('hash', hashZOMG)
      })
      it('should return undefined if not able to read file for hash', async () => {
        mockDirStore.get = jest.fn().mockResolvedValue(undefined)
        mockDirStore.mtimestamp = jest.fn()
          .mockResolvedValue(Promise.resolve(42))
        mockCacheStore.get = jest.fn().mockResolvedValue(undefined)

        const result = await staticFilesSource.getMetaData(new StaticFileNaclValue('bb'))
        return expect(result).toBeInstanceOf(InvalidStaticFile)
      })
    })
  })
  describe('Get Static File For Adapter', () => {
    it('should not find if not in cache', () =>
      expect(staticFilesSource.getStaticFile({ filepath: 'bla', hash: 'aaa' })).resolves.toBeUndefined())
    it('should find if in cache', async () => {
      mockCacheStore.get = jest.fn().mockResolvedValue({
        filepath: 'bbb',
        modified: 100,
        hash: 'aaa',
      })
      mockDirStore.get = jest.fn().mockResolvedValue({
        buffer: 'ZOMG',
      })
      return expect(staticFilesSource.getStaticFile({ filepath: 'bla', hash: 'aaa' }))
        .resolves.toHaveProperty('filepath', 'bla')
    })
  })
  describe('Flush', () => {
    it('should flush all directory stores', async () => {
      mockDirStore.flush = jest.fn().mockResolvedValue(Promise.resolve())
      mockCacheStore.flush = jest.fn().mockResolvedValue(Promise.resolve())
      await staticFilesSource.flush()
      expect(mockCacheStore.flush).toHaveBeenCalledTimes(1)
      expect(mockDirStore.flush).toHaveBeenCalledTimes(1)
    })
  })
  describe('Clear', () => {
    it('should clear all directory stores', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCacheStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      await staticFilesSource.clear()
      expect(mockCacheStore.clear).toHaveBeenCalledTimes(1)
      expect(mockDirStore.clear).toHaveBeenCalledTimes(1)
    })
  })
  describe('Clone', () => {
    it('should still get the same value', async () => {
      mockCacheStore.get = jest.fn().mockResolvedValue({
        filepath: 'bbb',
        modified: 100,
        hash: 'aaa',
      })
      mockDirStore.get = jest.fn().mockResolvedValue({
        buffer: 'ZOMG',
      })

      await expect(staticFilesSource.getStaticFile({ filepath: 'bla', hash: 'aaa' }))
        .resolves.toHaveProperty('filepath', 'bla')

      const clonedStaticFileSource = staticFilesSource.clone()

      return expect(clonedStaticFileSource.getStaticFile({ filepath: 'bla', hash: 'aaa' }))
        .resolves.toHaveProperty('filepath', 'bla')
    })
  })
})
