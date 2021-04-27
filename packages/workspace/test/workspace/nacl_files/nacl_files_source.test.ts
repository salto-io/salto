/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element, ElemID, ObjectType, DetailedChange, StaticFile, SaltoError, Value, ReferenceExpression, BuiltinTypes } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { ParsedNaclFileCache, createParseResultCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'

import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../../utils'
import * as parser from '../../../src/parser'
import { InMemoryRemoteMap, RemoteMapCreator, RemoteMap, CreateRemoteMapParams } from '../../../src/workspace/remote_map'
import { ParsedNaclFile } from '../../../src/workspace/nacl_files/parsed_nacl_file'

const { awu } = collections.asynciterable

const createChange = (): DetailedChange => {
  const newElemID = new ElemID('salesforce', 'new_elem')
  const newElem = new ObjectType({
    elemID: newElemID,
    path: ['test', 'new'],
    fields: {
      myField: {
        refType: new ReferenceExpression(BuiltinTypes.STRING.elemID, BuiltinTypes.STRING),
      },
    },
  })
  const change = {
    id: newElemID,
    action: 'add',
    data: { after: newElem },
    path: ['new', 'file'],
  } as DetailedChange
  return change
}

jest.mock('../../../src/workspace/nacl_files/nacl_file_update', () => ({
  ...jest.requireActual<{}>('../../../src/workspace/nacl_files/nacl_file_update'),
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
  ...jest.requireActual<{}>('../../../src/parser'),
  parse: jest.fn().mockResolvedValue({ elements: [], errors: [] }),
}))

const validateParsedNaclFile = async (
  parsed: ParsedNaclFile | undefined,
  filename: string,
  elements: Element[],
  errors: SaltoError[],
): Promise<void> => {
  expect(parsed).toBeDefined()
  if (parsed) {
    const parsedElements = await awu((await parsed.elements()) ?? []).toArray()
    expect(parsedElements).toEqual(elements)
    expect(await parsed.data.errors()).toEqual(errors)
    expect(parsed.filename).toEqual(filename)
  }
}

describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore<string>
  let mockCache: ParsedNaclFileCache
  let mockedStaticFilesSource: StaticFilesSource
  const mockParse = parser.parse as jest.Mock

  let createdMaps: Record<string, RemoteMap<Value>> = {}
  const mockRemoteMapCreator: RemoteMapCreator = async <T, K extends string = string>(
    { namespace }: CreateRemoteMapParams<T>
  ): Promise<RemoteMap<T, K>> => {
    const mockMap = {
      keys: jest.fn().mockReturnValue(awu([])),
      values: jest.fn().mockReturnValue(awu([])),
      entries: jest.fn().mockReturnValue(awu([])),
      setAll: jest.fn(),
      deleteAll: jest.fn(),
      clear: jest.fn(),
      deleteAll: jest.fn(),
      flush: jest.fn(),
      isEmpty: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(undefined),
      getMany: jest.fn().mockImplementation((keys: string[]) => keys.map(_k => undefined)),
    }
    createdMaps[namespace] = mockMap as unknown as RemoteMap<Value>
    return createdMaps[namespace] as RemoteMap<T, K>
  }

  beforeEach(async () => {
    createdMaps = {}
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
    mockCache = createParseResultCache(
      'test',
      persistentMockCreateRemoteMap(),
      mockStaticFilesSource(),
    )
    mockParse.mockResolvedValue({ elements: [], errors: [] })
  })

  describe('clear', () => {
    it('should delete everything by default', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        mockRemoteMapCreator,
      )
      await naclSrc.load({})
      await naclSrc.clear()
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      Object.values(createdMaps).forEach(cache => expect(cache.clear).toHaveBeenCalledTimes(1))
      expect(mockedStaticFilesSource.clear).toHaveBeenCalledTimes(1)
    })

    it('should delete only specified parts', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        mockRemoteMapCreator,
      )
      await naclSrc.load({})
      await naclSrc.clear(
        { nacl: true, staticResources: false, cache: true }
      )
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      Object.values(createdMaps).forEach(cache => expect(cache.clear).toHaveBeenCalledTimes(1))
      expect(mockedStaticFilesSource.clear).not.toHaveBeenCalled()
    })

    it('should throw if trying to clear static resources without nacls or cache', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        mockRemoteMapCreator,
      )
      await naclSrc.load({})
      await expect(naclSrc.clear(
        { nacl: false, staticResources: true, cache: true }
      )).rejects.toThrow('Cannot clear static resources without clearing the cache and nacls')
      expect(mockDirStore.clear as jest.Mock).not.toHaveBeenCalled()
      Object.values(createdMaps).forEach(cache => expect(cache.clear).not.toHaveBeenCalled())
      expect(mockedStaticFilesSource.clear).not.toHaveBeenCalled()
    })
  })

  describe('flush', () => {
    it('should flush everything by default', async () => {
      mockDirStore.flush = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        mockRemoteMapCreator,
      )
      await naclSrc.load({})
      await naclSrc.flush()
      expect(mockDirStore.flush as jest.Mock).toHaveBeenCalledTimes(1)
      Object.values(createdMaps).forEach(cache => expect(cache.flush).toHaveBeenCalledTimes(1))
      expect(mockedStaticFilesSource.flush).toHaveBeenCalledTimes(1)
    })
  })

  describe('isEmpty', () => {
    it('should use store\'s isEmpty', async () => {
      mockDirStore.isEmpty = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await naclSrc.load({})
      await naclSrc.isEmpty()
      expect(mockDirStore.isEmpty as jest.Mock).toHaveBeenCalledTimes(1)
    })
  })

  describe('load', () => {
    it('should list files', async () => {
      mockDirStore.list = jest.fn().mockResolvedValue(Promise.resolve([]))
      await (await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )).load({})
      expect(mockDirStore.list as jest.Mock).toHaveBeenCalled()
    })
    it('should not list files if ignoreFileChanges is set', async () => {
      mockDirStore.list = jest.fn().mockImplementation(async () => awu([]))
      await (await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )).load({ ignoreFileChanges: true })
      expect(mockDirStore.list as jest.Mock).not.toHaveBeenCalled()
    })
  })

  describe('rename', () => {
    it('should rename everything', async () => {
      const newName = 'new'
      mockDirStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.rename = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        mockRemoteMapCreator
      )
      await naclSrc.load({})
      await naclSrc.rename(newName)
      expect(mockDirStore.rename).toHaveBeenCalledTimes(1)
      expect(mockDirStore.rename).toHaveBeenCalledWith(newName)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledWith(newName)

      const cacheKeysToRename = [
        'elements_index',
        'referenced_index',
      ]
      cacheKeysToRename.forEach(key => {
        const mapNames = Object.keys(createdMaps).filter(namespaces => namespaces.includes(key))
        expect(mapNames).toHaveLength(2)
        const [[newMap], [oldMap]] = _.partition(mapNames, name => name.includes(newName))
        expect(createdMaps[newMap].setAll).toHaveBeenCalledTimes(1)
        expect(createdMaps[oldMap].entries).toHaveBeenCalledTimes(1)
      })
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
    const change = createChange()
    it('should not parse file when updating single add changes in a new file', async () => {
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await naclSrc.load({})
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
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await src.load({})
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
      const elements = [elem]
      const parsedFiles = [
        {
          filename,
          elements: () => Promise.resolve(elements),
          buffer: '',
          data: {
            errors: () => Promise.resolve([]),
            timestamp: () => Promise.resolve(0),
            referenced: () => Promise.resolve([]),
          },
        },
      ]
      const naclSource = naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        parsedFiles
      )
      const parsed = await (await naclSource).getParsedNaclFile(filename)
      expect(parsed).toBeDefined()
      expect(
        await (parsed as ParsedNaclFile).elements()
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
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
    })

    it('should return undefined if file doenst exist', async () => {
      await naclSource.load({})
      expect(await (await naclSource.getParsedNaclFile('nonExistentFile'))?.elements()).toBeUndefined()
    })
    it('should return parseResult when state is undefined', async () => {
      const elemID = new ElemID('dummy', 'elem')
      const elem = new ObjectType({ elemID, path: ['test', 'new'] })
      const elements = [elem];
      (mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData)
      mockParse.mockResolvedValueOnce({ elements, errors: [], filename: mockFileData.filename })
      await validateParsedNaclFile(
        await naclSource.getParsedNaclFile(mockFileData.filename),
        mockFileData.filename,
        elements,
        [],
      )
    })
    it('should return undefined if state is undefined and file does not exist', async () => {
      (mockDirStore.get as jest.Mock).mockResolvedValue(undefined)
      expect(await naclSource.getParsedNaclFile(mockFileData.filename)).toEqual(undefined)
    })
  })

  describe('list', () => {
    let src: NaclFilesSource
    beforeEach(async () => {
      src = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await src.load({})
      await src.updateNaclFiles([createChange()])
    })

    it('should list all elements', async () => {
      expect(await awu(await src.list()).toArray()).toHaveLength(1)
    })
  })

  describe('getSearchableNames', () => {
    let src: NaclFilesSource
    beforeEach(async () => {
      src = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      await src.load({})
      await src.updateNaclFiles([createChange()])
    })

    it('should list all searchable elements', async () => {
      expect(await src.getSearchableNames())
        .toEqual(['salesforce.new_elem', 'salesforce.new_elem.field.myField'])
    })
  })
})
