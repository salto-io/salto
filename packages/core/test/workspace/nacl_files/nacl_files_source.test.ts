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

import { naclFilesSource } from '../../../src/workspace/nacl_files/nacl_files_source'
import { StaticFilesSource } from '../../../src/workspace/static_files/common'
import { ParseResultCache } from '../../../src/workspace/cache'

import { mockStaticFilesSource } from '../static_files/common.test'


describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore
  let mockCache: ParseResultCache
  let mockedStaticFilesSource: StaticFilesSource
  beforeEach(() => {
    mockCache = {
      get: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(undefined),
      clone: () => mockCache,
      flush: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
    }
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
    mockedStaticFilesSource = mockStaticFilesSource()
  })

  describe('clear', () => {
    it('should delete everything', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      await naclFilesSource(mockDirStore, mockCache, mockedStaticFilesSource).clear()
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      expect(mockCache.clear).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.clear).toHaveBeenCalledTimes(1)
    })
  })

  describe('rename', () => {
    it('should rename everything', async () => {
      const newName = 'new'
      mockDirStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.rename = jest.fn().mockResolvedValue(Promise.resolve())
      await naclFilesSource(mockDirStore, mockCache, mockedStaticFilesSource).rename(newName)
      expect(mockDirStore.rename).toHaveBeenCalledTimes(1)
      expect(mockDirStore.rename).toHaveBeenCalledWith(newName)
      expect(mockCache.rename).toHaveBeenCalledTimes(1)
      expect(mockCache.rename).toHaveBeenCalledWith(newName)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledWith(newName)
    })
  })
})
