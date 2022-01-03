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
import { Element, ElemID, ObjectType, DetailedChange, StaticFile, SaltoError, Value, BuiltinTypes, createRefToElmWithValue } from '@salto-io/adapter-api'
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
import * as naclFileSourceModule from '../../../src/workspace/nacl_files/nacl_files_source'

const { awu } = collections.asynciterable

const createChange = (): DetailedChange => {
  const newElemID = new ElemID('salesforce', 'new_elem')
  const newElem = new ObjectType({
    elemID: newElemID,
    path: ['test', 'new'],
    fields: {
      myField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
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
      set: jest.fn().mockResolvedValue(undefined),
      deleteAll: jest.fn(),
      clear: jest.fn(),
      flush: jest.fn(),
      isEmpty: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockImplementation(
        async (key: string) => (key.endsWith('hash') ? 'HASH' : undefined)
      ),
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
      isPathIncluded: jest.fn(),
    }
    mockedStaticFilesSource = mockStaticFilesSource()
    mockCache = createParseResultCache(
      'test',
      persistentMockCreateRemoteMap(),
      mockStaticFilesSource(),
      true
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
        true
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
        true
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
        mockRemoteMapCreator, true

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
        true
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
        true
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
        true
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
        true
      )).load({ ignoreFileChanges: true })
      expect(mockDirStore.list as jest.Mock).not.toHaveBeenCalled()
    })
    it('should not access rocks db when ignore file changes flag is set', async () => {
      mockDirStore.list = jest.fn().mockImplementation(async () => awu([]))
      const retrievedKeys: string[] = []
      await (await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        <T, K extends string>() => {
          const origMap = new InMemoryRemoteMap<T, K>()
          const wrappedMap = {
            ...origMap,
            get: (key: K) => {
              retrievedKeys.push(key)
              return origMap.get(key)
            },
          } as unknown as RemoteMap<T, K>
          return Promise.resolve(wrappedMap)
        },
        true
      )).load({ ignoreFileChanges: true })
      expect(retrievedKeys).toEqual([])
    })
  })

  describe('rename', () => {
    it('should rename everything', async () => {
      const newName = 'new'
      const oldName = 'old'
      mockDirStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.rename = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        oldName,
        mockDirStore,
        mockedStaticFilesSource,
        mockRemoteMapCreator,
        true
      )
      await naclSrc.load({})
      jest.clearAllMocks()
      await naclSrc.rename(newName)
      expect(mockDirStore.rename).toHaveBeenCalledTimes(1)
      expect(mockDirStore.rename).toHaveBeenCalledWith(newName)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledWith(newName)

      const cacheKeysToRename = [
        'elements_index',
        'referenced_index',
        'metadata',
        'searchableNamesIndex',
      ]
      cacheKeysToRename.forEach(key => {
        const mapNames = Object.keys(createdMaps)
          .filter(namespace => !namespace.includes('parsedResultCache'))
          .filter(namespaces => namespaces.includes(key))
        expect(mapNames).toHaveLength(2)
        const [[newMap], [oldMap]] = _.partition(mapNames, name => name.includes(newName))
        expect(createdMaps[newMap].setAll).toHaveBeenCalledTimes(1)
        expect(createdMaps[oldMap].entries).toHaveBeenCalledTimes(1)
      })

      // make sure all new maps are created with the proper names
      const oldNames = Object.keys(createdMaps).filter(namespaces => namespaces.includes(oldName))
      const newNames = new Set(Object.keys(createdMaps)
        .filter(namespaces => namespaces.includes(newName)))
      oldNames.forEach(namespace =>
        expect(newNames.has(namespace.replace(oldName, newName))).toBeTruthy())
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
          true
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
        true
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
        true
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
      const parsedFiles: ParsedNaclFile[] = [
        {
          filename,
          elements: () => Promise.resolve(elements),
          buffer: '',
          data: {
            errors: () => Promise.resolve([]),
            referenced: () => Promise.resolve([]),
          },
        },
      ]
      const naclSource = naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true,
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
        true
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

    it('should cache referenced result on parsedNaclFile', async () => {
      (mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData)
      const elements = [new ObjectType({ elemID: new ElemID('dummy', 'elem') })]
      mockParse.mockResolvedValueOnce({ elements, errors: [], filename: mockFileData.filename })
      const mockGetElementReferenced = jest.spyOn(naclFileSourceModule, 'getElementReferenced')
      const parsed = await naclSource.getParsedNaclFile(mockFileData.filename)
      expect(parsed).toBeDefined()
      await parsed?.data.referenced()
      expect(mockGetElementReferenced).toHaveBeenCalled()
      mockGetElementReferenced.mockClear()
      await parsed?.data.referenced()
      expect(mockGetElementReferenced).not.toHaveBeenCalled()
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
        true
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
        true
      )
      await src.load({})
      await src.updateNaclFiles([createChange()])
    })

    it('should list all searchable elements', async () => {
      expect(await src.getSearchableNames())
        .toEqual(['salesforce.new_elem', 'salesforce.new_elem.field.myField'])
    })
  })

  describe('non persistent naclFileSource', () => {
    it('should not allow flush when the ws is non-persistent', async () => {
      const nonPSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false
      )
      await expect(nonPSrc.flush()).rejects.toThrow()
    })
  })

  describe('getStaticFileByHash', () => {
    const staticFileSource = mockStaticFilesSource()
    const staticFile = new StaticFile({
      content: Buffer.from(''),
      filepath: 'aaa.txt',
      encoding: 'utf-8',
      hash: 'aaa',
    })
    it('should return the file it is present and the hashes match', async () => {
      staticFileSource.getStaticFile = jest.fn().mockResolvedValueOnce(staticFile)
      const src = await naclFilesSource(
        '',
        mockDirStore,
        staticFileSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false
      )
      expect(await src.getStaticFile(
        staticFile.filepath, staticFile.encoding
      )).toEqual(staticFile)
    })
  })

  describe('isPathIncluded', () => {
    let src: NaclFilesSource
    const staticFileSource = mockStaticFilesSource([
      new StaticFile({
        content: Buffer.from('FFF'),
        filepath: 'static-files/fff.txt',
        hash: '###',
      }),
    ])
    beforeEach(async () => {
      src = await naclFilesSource(
        '',
        mockDirStore,
        staticFileSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false
      )
    })
    it('should mark a path of a nacl file as included', () => {
      (mockDirStore.isPathIncluded as jest.Mock).mockReturnValue(true)
      expect(src.isPathIncluded('whateves.nacl')).toEqual({
        included: true,
        isNacl: true,
      })
    })

    it('should mark a static file as included', () => {
      (mockDirStore.isPathIncluded as jest.Mock).mockReturnValue(false)
      expect(src.isPathIncluded('static-files/fff.txt')).toEqual({
        included: true,
        isNacl: false,
      })
    })

    it('should mark a missing file as not included', () => {
      (mockDirStore.isPathIncluded as jest.Mock).mockReturnValue(false)
      expect(src.isPathIncluded('whateves.nacl')).toEqual({
        included: false,
      })
    })
  })
})
