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

import { StaticFilesSource } from '../../../src/workspace/static_files/source'

import { naclFilesSource } from '../../../src/workspace/nacl_files/nacl_files_source'
import { ParseResultCache } from '../../../src/workspace/cache'


describe('Nacl Files Source', () => {
  let mockStaticFilesSource: StaticFilesSource
  let mockDirStore: DirectoryStore
  let mockCache: ParseResultCache
  beforeEach(() => {
    mockStaticFilesSource = {
      getMetaData: jest.fn().mockResolvedValue(undefined),
      getStaticFile: jest.fn().mockResolvedValue(undefined),
      flush: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
      clone: () => mockStaticFilesSource,
    }
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
      flush: () => Promise.resolve(),
      mtimestamp: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
      clone: () => mockDirStore,
    }
  })

  describe('clear', () => {
    it('should delete everything', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      await naclFilesSource(mockDirStore, mockCache, mockStaticFilesSource).clear()
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      expect(mockCache.clear).toHaveBeenCalledTimes(1)
      expect(mockStaticFilesSource.clear).toHaveBeenCalledTimes(1)
    })
  })
})
