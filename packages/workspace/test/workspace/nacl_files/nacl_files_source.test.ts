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
import { ElemID, ObjectType, DetailedChange } from '@salto-io/adapter-api'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { ParseResultCache } from '../../../src/workspace/cache'

import { mockStaticFilesSource } from '../static_files/common.test'
import { parse } from '../../../src/parser'

jest.mock('../../../src/parser')
describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore<string>
  let mockCache: ParseResultCache
  let mockedStaticFilesSource: StaticFilesSource
  const mockParse = parse as jest.Mock

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
      getTotalSize: () => Promise.resolve(0),
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

  describe('getTotalSize', () => {
    it('should calc getTotalSize', async () => {
      mockDirStore.getTotalSize = jest.fn().mockResolvedValue(Promise.resolve(100))
      mockedStaticFilesSource.getTotalSize = jest.fn().mockResolvedValue(Promise.resolve(200))
      const totalSize = await naclFilesSource(mockDirStore, mockCache, mockedStaticFilesSource)
        .getTotalSize()
      expect(totalSize).toEqual(300)
      expect(mockDirStore.getTotalSize).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.getTotalSize).toHaveBeenCalledTimes(1)
    })
  })

  describe('parse optimization', () => {
    const newElemID = new ElemID('salesforce', 'new_elem')
    const newElem = new ObjectType({
      elemID: newElemID,
      path: ['test', 'new'],
    })
    const change = {
      id: newElemID,
      action: 'add',
      data: { after: newElem },
      path: ['new', 'file'],
    } as DetailedChange
    it('should not parse file when updating single add changes in a new file', async () => {
      await naclFilesSource(mockDirStore, mockCache, mockedStaticFilesSource)
        .updateNaclFiles([change])
      expect(mockParse).not.toHaveBeenCalled()
    })
  })

  describe('init with parsed files', () => {
    it('should return elements from given parsed files', async () => {
      const filename = 'mytest.nacl'
      const elemID = new ElemID('dummy', 'elem')
      const elem = new ObjectType({ elemID, path: ['test', 'new'] })
      const elements = { 'dummy.elem': elem }
      const parsedFiles = [{ filename, elements, errors: [], timestamp: 0 }]
      const naclSource = naclFilesSource(
        mockDirStore, mockCache, mockedStaticFilesSource, parsedFiles
      )
      expect(await naclSource.getElements(filename)).toEqual([elem])
    })
  })
})
