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
import { Element, ElemID, ObjectType, DetailedChange, StaticFile, SaltoError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { ParsedNaclFileCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'

import { mockStaticFilesSource } from '../../utils'
import * as parser from '../../../src/parser'
import { createInMemoryElementSource } from '../../../src/workspace/elements_source'
import { InMemoryRemoteMap } from '../../../src/workspace/remote_map'
import { ParsedNaclFile } from '../../../src/workspace/nacl_files/parsed_nacl_file'
import { toParsedNaclFile } from '../../../src/workspace/nacl_files/nacl_files_source'

const { awu } = collections.asynciterable

jest.mock('../../../src/workspace/nacl_files/nacl_file_update', () => ({
  ...jest.requireActual('../../../src/workspace/nacl_files/nacl_file_update'),
  getChangeLocations: (change: DetailedChange) => ({
    ...change,
    location: {
      filename: 'file',
      start: { line: 0, row: 0, byte: 0 },
      end: { line: 0, row: 0, byte: 0 },
    },
  }),
}))

jest.mock('../../../src/parser', () => ({
  ...jest.requireActual('../../../src/parser'),
  parse: jest.fn().mockResolvedValue({ elements: [], errors: [] }),
}))

const validateParsedNaclFile = async (
  parsed: ParsedNaclFile | undefined,
  filename: string,
  elements: Element[],
  errors: SaltoError[],
): Promise<void> => {
  if (parsed) {
    const parsedElements = await awu(await parsed.elements.getAll()).toArray()
    expect(parsedElements).toEqual(elements)
    expect(parsed.data.errors).toEqual(errors)
    expect(parsed.filename).toEqual(filename)
  }
}

describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore<string>
  let mockCache: ParsedNaclFileCache
  let mockedStaticFilesSource: StaticFilesSource
  const mockParse = parser.parse as jest.Mock

  beforeEach(() => {
    mockCache = {
      get: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(undefined),
      clone: () => mockCache,
      flush: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      list: () => Promise.resolve([]),
      getAllErrors: () => Promise.resolve([]),
      hasValid: () => Promise.resolve(true),
    }
    mockDirStore = {
      list: () => Promise.resolve([]),
      isEmpty: () => Promise.resolve(false),
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
      getFullPath: filename => filename,
    }
    mockedStaticFilesSource = mockStaticFilesSource()
    mockParse.mockResolvedValue({ elements: [], errors: [] })
  })

  describe('clear', () => {
    it('should delete everything by default', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      await ((await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      ))).clear()
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      expect(mockCache.clear).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.clear).toHaveBeenCalledTimes(1)
    })

    it('should delete only specified parts', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      await (await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )).clear(
        { nacl: true, staticResources: false, cache: true }
      )
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      expect(mockCache.clear).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.clear).not.toHaveBeenCalled()
    })

    it('should throw if trying to clear static resources without nacls or cache', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      await expect((await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )).clear(
        { nacl: false, staticResources: true, cache: true }
      )).rejects.toThrow('Cannot clear static resources without clearing the cache and nacls')
      expect(mockDirStore.clear as jest.Mock).not.toHaveBeenCalled()
      expect(mockCache.clear).not.toHaveBeenCalled()
      expect(mockedStaticFilesSource.clear).not.toHaveBeenCalled()
    })
  })

  describe('isEmpty', () => {
    it('should use store\'s isEmpty', async () => {
      mockDirStore.isEmpty = jest.fn().mockResolvedValue(Promise.resolve())
      await (await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )).isEmpty()
      expect(mockDirStore.isEmpty as jest.Mock).toHaveBeenCalledTimes(1)
    })
  })

  describe('rename', () => {
    it('should rename everything', async () => {
      const newName = 'new'
      mockDirStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.rename = jest.fn().mockResolvedValue(Promise.resolve())
      await (await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap())
      )).rename(newName)
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
      const totalSize = await (
        await naclFilesSource(
          '',
          mockDirStore,
          mockCache,
          mockedStaticFilesSource,
          () => Promise.resolve(new InMemoryRemoteMap()),
        )
      ).getTotalSize()
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
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await naclSrc.load()
      await naclSrc.updateNaclFiles([change])
      expect(mockParse).not.toHaveBeenCalled()
    })
  })

  describe('removing static files', () => {
    const elemID = new ElemID('salesforce', 'new_elem')
    const filepath = 'to/the/superbowl'
    const sfile = new StaticFile({ filepath, hash: 'XI' })
    let src: NaclFilesSource
    beforeEach(async () => {
      src = await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await src.load()
    })
    it('should not parse file when updating single add changes in a new file', async () => {
      const change = {
        id: elemID,
        action: 'remove',
        data: { before: sfile },
        path: ['new', 'file'],
      } as DetailedChange
      await src.updateNaclFiles([change])
      expect(mockedStaticFilesSource.delete).toHaveBeenCalledWith(sfile)
    })
  })

  describe('init with parsed files', () => {
    it('should return elements from given parsed files', async () => {
      const filename = 'mytest.nacl'
      const elemID = new ElemID('dummy', 'elem')
      const elem = new ObjectType({ elemID, path: ['test', 'new'] })
      const elements = createInMemoryElementSource([elem])
      const parsedFiles = [
        {
          filename,
          elements,
          buffer: '',
          data: {
            errors: [],
            timestamp: 0,
            referenced: [],
          },
        },
      ]
      const naclSource = naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        parsedFiles
      )
      const parsed = await (await naclSource).getParsedNaclFile(filename)
      expect(parsed).toBeDefined()
      expect(
        await awu(await (parsed as ParsedNaclFile).elements.getAll()).toArray()
      ).toEqual([elem])
    })
  })

  describe('getParsedNaclFile', () => {
    let naclSource: NaclFilesSource
    const mockFileData = { buffer: 'someData {}', filename: 'somefile.nacl' }

    beforeEach(async () => {
      naclSource = await naclFilesSource(
        '',
        mockDirStore,
        mockCache,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
    })

    it('should return undefined if file doenst exist', async () => {
      expect(await naclSource.getParsedNaclFile('nonExistentFile')).toBeUndefined()
    })
    it('should return parseResult when parse cache is not updated', async () => {
      const elemID = new ElemID('dummy', 'elem')
      const elem = new ObjectType({ elemID, path: ['test', 'new'] })
      const elements = [elem];
      (mockCache.get as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData)
      mockParse.mockResolvedValueOnce({ elements, errors: [], filename: mockFileData.filename })
      await validateParsedNaclFile(
        await naclSource.getParsedNaclFile(mockFileData.filename),
        mockFileData.filename,
        elements,
        [],
      )
    })
    it('should return cached result if updated', async () => {
      mockParse.mockClear()
      const elemID = new ElemID('dummy', 'elem')
      const elem = new ObjectType({ elemID, path: ['test', 'new'] })
      const elements = [elem];
      (mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData);
      (mockCache.get as jest.Mock).mockImplementation(async () => toParsedNaclFile(
        mockFileData,
        {
          elements,
          errors: [],
        }
      ))
      await validateParsedNaclFile(
        await naclSource.getParsedNaclFile(mockFileData.filename),
        mockFileData.filename,
        elements,
        [],
      )
      expect(mockParse).not.toHaveBeenCalled()
    })
  })
})
