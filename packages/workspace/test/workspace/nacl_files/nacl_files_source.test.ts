/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  Element,
  ElemID,
  ObjectType,
  DetailedChange,
  StaticFile,
  SaltoError,
  Value,
  BuiltinTypes,
  createRefToElmWithValue,
  InstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { parser } from '@salto-io/parser'
import { detailedCompare } from '@salto-io/adapter-utils'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource, MissingStaticFile } from '../../../src/workspace/static_files'
import { ParsedNaclFileCache, createParseResultCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'

import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../../utils'
import {
  InMemoryRemoteMap,
  RemoteMapCreator,
  RemoteMap,
  CreateRemoteMapParams,
} from '../../../src/workspace/remote_map'
import { ParsedNaclFile } from '../../../src/workspace/nacl_files/parsed_nacl_file'
import * as naclFileSourceModule from '../../../src/workspace/nacl_files/nacl_files_source'
import { mockDirStore as createMockDirStore } from '../../common/nacl_file_store'
import { getDanglingStaticFiles } from '../../../src/workspace/nacl_files/nacl_files_source'
import { DetailedChangeWithSource, getChangeLocations } from '../../../src/workspace/nacl_files/nacl_file_update'

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
  getChangeLocations: jest.fn(),
}))

jest.mock('@salto-io/parser', () => {
  const actual = jest.requireActual('@salto-io/parser')
  return {
    ...actual,
    parser: {
      ...actual.parser,
      parse: jest.fn().mockImplementation(actual.parser.parse),
    },
  }
})

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
    parsedElements.forEach(elem => expect(elem.path).toEqual(naclFileSourceModule.toPathHint(filename)))
    expect(await parsed.data.errors()).toEqual(errors)
    expect(parsed.filename).toEqual(filename)
  }
}

const mockParse = jest.mocked(parser).parse

describe('Nacl Files Source', () => {
  let getChangeLocationsMock: jest.MockedFunction<typeof getChangeLocations>
  let mockDirStore: MockInterface<DirectoryStore<string>>
  let mockCache: ParsedNaclFileCache
  let mockedStaticFilesSource: StaticFilesSource

  let createdMaps: Record<string, RemoteMap<Value>> = {}
  const mockRemoteMapCreator: RemoteMapCreator = async <T, K extends string = string>({
    namespace,
  }: CreateRemoteMapParams<T>): Promise<RemoteMap<T, K>> => {
    if (createdMaps[namespace] === undefined) {
      const realMap = new InMemoryRemoteMap()
      const getImpl = async (key: string): Promise<Value> => (key.endsWith('hash') ? 'HASH' : realMap.get(key))
      createdMaps[namespace] = {
        delete: mockFunction<RemoteMap<Value>['delete']>(),
        get: mockFunction<RemoteMap<Value>['get']>().mockImplementation(getImpl),
        getMany: mockFunction<RemoteMap<Value>['getMany']>().mockImplementation(async keys =>
          Promise.all(keys.map(getImpl)),
        ),
        has: mockFunction<RemoteMap<Value>['has']>().mockImplementation(
          async key => key.endsWith('hash') || realMap.has(key),
        ),
        set: mockFunction<RemoteMap<Value>['set']>().mockImplementation(realMap.set.bind(realMap)),
        setAll: mockFunction<RemoteMap<Value>['setAll']>().mockImplementation(realMap.setAll.bind(realMap)),
        deleteAll: mockFunction<RemoteMap<Value>['deleteAll']>().mockImplementation(realMap.deleteAll.bind(realMap)),
        entries: mockFunction<RemoteMap<Value>['entries']>().mockImplementation(realMap.entries.bind(realMap)),
        keys: mockFunction<RemoteMap<Value>['keys']>().mockImplementation(realMap.keys.bind(realMap)),
        values: mockFunction<RemoteMap<Value>['values']>().mockImplementation(realMap.values.bind(realMap)),
        flush: mockFunction<RemoteMap<Value>['flush']>().mockImplementation(realMap.flush.bind(realMap)),
        revert: mockFunction<RemoteMap<Value>['revert']>().mockImplementation(realMap.revert.bind(realMap)),
        clear: mockFunction<RemoteMap<Value>['clear']>().mockImplementation(realMap.clear.bind(realMap)),
        close: mockFunction<RemoteMap<Value>['close']>().mockImplementation(realMap.close.bind(realMap)),
        isEmpty: mockFunction<RemoteMap<Value>['isEmpty']>().mockImplementation(realMap.isEmpty.bind(realMap)),
      }
    }
    return createdMaps[namespace] as RemoteMap<T, K>
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    createdMaps = {}
    mockDirStore = createMockDirStore([], true)
    mockedStaticFilesSource = mockStaticFilesSource()
    mockCache = createParseResultCache('test', persistentMockCreateRemoteMap(), mockStaticFilesSource(), true)
    getChangeLocationsMock = getChangeLocations as jest.MockedFunction<typeof getChangeLocations>
    getChangeLocationsMock.mockImplementation(
      (change: DetailedChange) =>
        ({
          ...change,
          location: {
            filename: 'file',
            start: { line: 0, row: 0, byte: 0 },
            end: { line: 0, row: 0, byte: 0 },
          },
        }) as unknown as DetailedChangeWithSource[],
    )
  })

  describe('clear', () => {
    it('should delete everything by default', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, mockRemoteMapCreator, true)
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
      const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, mockRemoteMapCreator, true)
      await naclSrc.load({})
      await naclSrc.clear({ nacl: true, staticResources: false, cache: true })
      expect(mockDirStore.clear as jest.Mock).toHaveBeenCalledTimes(1)
      Object.values(createdMaps).forEach(cache => expect(cache.clear).toHaveBeenCalledTimes(1))
      expect(mockedStaticFilesSource.clear).not.toHaveBeenCalled()
    })

    it('should throw if trying to clear static resources without nacls or cache', async () => {
      mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, mockRemoteMapCreator, true)
      await naclSrc.load({})
      await expect(naclSrc.clear({ nacl: false, staticResources: true, cache: true })).rejects.toThrow(
        'Cannot clear static resources without clearing the cache and nacls',
      )
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
      const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, mockRemoteMapCreator, true)
      await naclSrc.load({})
      await naclSrc.flush()
      expect(mockDirStore.flush as jest.Mock).toHaveBeenCalledTimes(1)
      Object.values(createdMaps).forEach(cache => expect(cache.flush).toHaveBeenCalledTimes(1))
      expect(mockedStaticFilesSource.flush).toHaveBeenCalledTimes(1)
    })
  })

  describe('isEmpty', () => {
    it("should use store's isEmpty", async () => {
      mockDirStore.isEmpty = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true,
      )
      await naclSrc.load({})
      await naclSrc.isEmpty()
      expect(mockDirStore.isEmpty as jest.Mock).toHaveBeenCalledTimes(1)
    })
  })

  describe('load', () => {
    it('should list files', async () => {
      mockDirStore.list = jest.fn().mockResolvedValue(Promise.resolve([]))
      await (
        await naclFilesSource(
          '',
          mockDirStore,
          mockedStaticFilesSource,
          () => Promise.resolve(new InMemoryRemoteMap()),
          true,
        )
      ).load({})
      expect(mockDirStore.list as jest.Mock).toHaveBeenCalled()
    })
    it('should not list files if ignoreFileChanges is set', async () => {
      mockDirStore.list = jest.fn().mockImplementation(async () => awu([]))
      await (
        await naclFilesSource(
          '',
          mockDirStore,
          mockedStaticFilesSource,
          () => Promise.resolve(new InMemoryRemoteMap()),
          true,
        )
      ).load({ ignoreFileChanges: true })
      expect(mockDirStore.list as jest.Mock).not.toHaveBeenCalled()
    })
    it('should not access rocks db when ignore file changes flag is set', async () => {
      mockDirStore.list = jest.fn().mockImplementation(async () => awu([]))
      const retrievedKeys: string[] = []
      await (
        await naclFilesSource(
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
          true,
        )
      ).load({ ignoreFileChanges: true })
      expect(retrievedKeys).toEqual([])
    })
    describe('nacl source hash', () => {
      describe('when hash changes to be empty', () => {
        it('should remove the current hash from the metadata remote map', async () => {
          // note - the default implementation returns "hash" as the "previous" hash
          // using an empty dir store, so the update hash will be empty
          const naclSource = await naclFilesSource(
            '',
            mockDirStore,
            mockStaticFilesSource(),
            mockRemoteMapCreator,
            true,
          )
          const res = await naclSource.load({})
          expect(res.postChangeHash).toBeUndefined()
          const metadataMap = createdMaps['naclFileSource--metadata']
          expect(metadataMap.delete).toHaveBeenCalledWith(naclFileSourceModule.HASH_KEY)
        })
      })
      describe('when hash changes to non empty value', () => {
        it('should set the new value', async () => {
          const naclSource = await naclFilesSource(
            '',
            createMockDirStore(),
            mockStaticFilesSource(),
            mockRemoteMapCreator,
            true,
          )
          const res = await naclSource.load({})
          expect(res.postChangeHash).toBeDefined()
          const metadataMap = createdMaps['naclFileSource--metadata']
          expect(metadataMap.set).toHaveBeenCalledWith(naclFileSourceModule.HASH_KEY, res.postChangeHash)
        })
      })
    })
  })

  describe('rename', () => {
    it('should rename everything', async () => {
      const newName = 'new'
      const oldName = 'old'
      mockDirStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockCache.rename = jest.fn().mockResolvedValue(Promise.resolve())
      mockedStaticFilesSource.rename = jest.fn().mockResolvedValue(Promise.resolve())
      const naclSrc = await naclFilesSource(oldName, mockDirStore, mockedStaticFilesSource, mockRemoteMapCreator, true)
      await naclSrc.load({})
      jest.clearAllMocks()
      await naclSrc.rename(newName)
      expect(mockDirStore.rename).toHaveBeenCalledTimes(1)
      expect(mockDirStore.rename).toHaveBeenCalledWith(newName)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledTimes(1)
      expect(mockedStaticFilesSource.rename).toHaveBeenCalledWith(newName)

      const cacheKeysToRename = ['elements_index', 'referenced_index', 'metadata', 'searchableNamesIndex']
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
      const newNames = new Set(Object.keys(createdMaps).filter(namespaces => namespaces.includes(newName)))
      oldNames.forEach(namespace => expect(newNames.has(namespace.replace(oldName, newName))).toBeTruthy())
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
          true,
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
        true,
      )
      await naclSrc.load({})
      await naclSrc.updateNaclFiles([change])
      expect(mockParse).not.toHaveBeenCalled()
    })
  })

  describe('removing static files', () => {
    const elemID = new ElemID('salesforce', 'new_elem')
    const filepath = 'to/the/superbowl'
    const afterFilePath = 'to/the/superbowl2'
    const sfile = new StaticFile({ filepath, hash: 'XI' })
    let src: NaclFilesSource
    beforeEach(async () => {
      src = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true,
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
    it('should delete before file when path is changed', async () => {
      const change = {
        id: elemID,
        action: 'modify',
        data: { before: sfile, after: new StaticFile({ filepath: afterFilePath, hash: 'XI' }) },
        path: ['new', 'file'],
      } as DetailedChange
      await src.updateNaclFiles([change])
      expect(mockedStaticFilesSource.delete).toHaveBeenCalledWith(sfile)
    })
    it('should delete before file when it is no longer a static file', async () => {
      const change = {
        id: elemID,
        action: 'modify',
        data: { before: sfile, after: '' },
        path: ['new', 'file'],
      } as DetailedChange
      await src.updateNaclFiles([change])
      expect(mockedStaticFilesSource.delete).toHaveBeenCalledWith(sfile)
    })
    it('should not delete static file if the change is only in content and not in path', async () => {
      const change = {
        id: elemID,
        action: 'modify',
        data: { before: sfile, after: new StaticFile({ filepath, hash: 'XII' }) },
        path: ['new', 'file'],
      } as DetailedChange
      await src.updateNaclFiles([change])
      expect(mockedStaticFilesSource.delete).toHaveBeenCalledTimes(0)
    })
    it('should not delete static file if the file was both added and deleted', async () => {
      getChangeLocationsMock.mockImplementationOnce(
        (change: DetailedChange) =>
          ({
            ...change,
            location: {
              filename: 'file1',
              start: { line: 0, row: 0, byte: 0 },
              end: { line: 0, row: 0, byte: 0 },
            },
          }) as unknown as DetailedChangeWithSource[],
      )
      getChangeLocationsMock.mockImplementationOnce(
        (change: DetailedChange) =>
          ({
            ...change,
            location: {
              filename: 'file2',
              start: { line: 0, row: 0, byte: 0 },
              end: { line: 0, row: 0, byte: 0 },
            },
          }) as unknown as DetailedChangeWithSource[],
      )
      const changeAdd = {
        id: new ElemID('salesforce', 'new_elem2'),
        action: 'add',
        data: { after: new StaticFile({ filepath, hash: 'XII' }) },
        path: ['new', 'file'],
      } as DetailedChange
      const changeDelete = {
        id: elemID,
        action: 'remove',
        data: { before: new StaticFile({ filepath, hash: 'XII' }) },
        path: ['old', 'file2'],
      } as DetailedChange
      await src.updateNaclFiles([changeAdd, changeDelete])
      expect(mockedStaticFilesSource.delete).toHaveBeenCalledTimes(0)
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
            staticFiles: () => Promise.resolve([]),
          },
        },
      ]
      const naclSource = naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true,
        parsedFiles,
      )
      const parsed = await (await naclSource).getParsedNaclFile(filename)
      expect(parsed).toBeDefined()
      expect(await (parsed as ParsedNaclFile).elements()).toEqual([elem])
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
        true,
      )
    })

    it('should return undefined if file doenst exist', async () => {
      await naclSource.load({})
      expect(await (await naclSource.getParsedNaclFile('nonExistentFile'))?.elements()).toBeUndefined()
    })
    it('should return parseResult when state is undefined', async () => {
      const elemID = new ElemID('dummy', 'elem')
      const elem = new ObjectType({ elemID, path: ['test', 'new'] })
      const elements = [elem]
      ;(mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData)
      mockParse.mockResolvedValueOnce({ elements, errors: [] })
      await validateParsedNaclFile(
        await naclSource.getParsedNaclFile(mockFileData.filename),
        mockFileData.filename,
        elements,
        [],
      )
    })
    it('should return undefined if state is undefined and file does not exist', async () => {
      ;(mockDirStore.get as jest.Mock).mockResolvedValue(undefined)
      expect(await naclSource.getParsedNaclFile(mockFileData.filename)).toEqual(undefined)
    })

    it('should cache referenced result on parsedNaclFile', async () => {
      ;(mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData)
      const elements = [new ObjectType({ elemID: new ElemID('dummy', 'elem') })]
      mockParse.mockResolvedValueOnce({ elements, errors: [] })
      const mockGetElementReferenced = jest.spyOn(naclFileSourceModule, 'getElementReferenced')
      const parsed = await naclSource.getParsedNaclFile(mockFileData.filename)
      expect(parsed).toBeDefined()
      await parsed?.data.referenced()
      expect(mockGetElementReferenced).toHaveBeenCalled()
      mockGetElementReferenced.mockClear()
      await parsed?.data.referenced()
      expect(mockGetElementReferenced).not.toHaveBeenCalled()
    })

    it('should return static file references', async () => {
      mockDirStore.get.mockResolvedValue(mockFileData)
      const elements = [
        new InstanceElement('inst', new ObjectType({ elemID: new ElemID('dummy', 'type') }), {
          file: new StaticFile({ filepath: 'file', content: Buffer.from('asd') }),
          missing: new MissingStaticFile('miss'),
        }),
      ]
      mockParse.mockResolvedValueOnce({ elements, errors: [] })
      const parsed = await naclSource.getParsedNaclFile(mockFileData.filename)
      expect(parsed).toBeDefined()
      const staticFiles = await parsed?.data.staticFiles()
      expect(staticFiles).toBeDefined()
      expect(staticFiles).toHaveLength(2)
      expect(staticFiles?.sort()).toEqual(['file', 'miss'])
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
        true,
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
        true,
      )
      await src.load({})
      await src.updateNaclFiles([createChange()])
    })

    it('should list all searchable elements', async () => {
      expect(await src.getSearchableNames()).toEqual(['salesforce.new_elem', 'salesforce.new_elem.field.myField'])
    })
  })

  describe('non persistent naclFileSource', () => {
    it('should not allow flush when the ws is non-persistent', async () => {
      const nonPSrc = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false,
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
        false,
      )
      expect(await src.getStaticFile({ filePath: staticFile.filepath, encoding: staticFile.encoding })).toEqual(
        staticFile,
      )
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
        false,
      )
    })
    it('should mark a path of a nacl file as included', () => {
      ;(mockDirStore.isPathIncluded as jest.Mock).mockReturnValue(true)
      expect(src.isPathIncluded('whateves.nacl')).toEqual({
        included: true,
        isNacl: true,
      })
    })

    it('should mark a static file as included', () => {
      ;(mockDirStore.isPathIncluded as jest.Mock).mockReturnValue(false)
      expect(src.isPathIncluded('static-files/fff.txt')).toEqual({
        included: true,
        isNacl: false,
      })
    })

    it('should mark a missing file as not included', () => {
      ;(mockDirStore.isPathIncluded as jest.Mock).mockReturnValue(false)
      expect(src.isPathIncluded('whateves.nacl')).toEqual({
        included: false,
      })
    })
  })
  describe('getElementFileNames', () => {
    it('should return correct result if there are files', async () => {
      const src1 = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true,
      )
      await src1.load({})
      await src1.updateNaclFiles([createChange()])
      const res = await src1.getElementFileNames()
      expect(Array.from(res.entries())).toEqual([['salesforce.new_elem', ['file']]])
    })
  })
  describe('getDanglingStaticFiles', () => {
    let beforeElem: InstanceElement
    let afterElem: InstanceElement
    let result: StaticFile[] = []
    const staticFile1 = new StaticFile({ filepath: 'path1', hash: 'hash1' })
    const staticFile2 = new StaticFile({ filepath: 'path2', hash: 'hash2' })
    const staticFile3 = new StaticFile({ filepath: 'path3', hash: 'hash3' })
    const staticFile4 = new StaticFile({ filepath: 'path4', hash: 'hash4' })
    const staticFile5 = new StaticFile({ filepath: 'path5', hash: 'hash5' })
    const staticFile6 = new StaticFile({ filepath: 'path6', hash: 'hash6' })

    beforeAll(() => {
      beforeElem = new InstanceElement('elem', new ObjectType({ elemID: new ElemID('salesforce', 'type') }), {
        f1: staticFile1, // To modify
        f2: staticFile2, // To remove
        f3: staticFile5, // To change location
        a: { f3: staticFile3 }, // To modify
        b: { f4: staticFile4 }, // To remove
      })
      afterElem = beforeElem.clone()

      afterElem.value.f1 = staticFile6
      afterElem.value.f5 = staticFile5
      delete afterElem.value.f2
      delete afterElem.value.f3
      afterElem.value.a = 's'
      delete afterElem.value.b

      result = getDanglingStaticFiles(detailedCompare(beforeElem, afterElem))
      expect(result).toHaveLength(4)
    })
    it('should return static file that was modified', () => {
      expect(result).toContain(staticFile1)
    })
    it('should return static file that was removed', () => {
      expect(result).toContain(staticFile2)
    })
    it('should return static file nested inside modification of another field', () => {
      expect(result).toContain(staticFile3)
    })
    it('should return static file nested inside removal of another field', () => {
      expect(result).toContain(staticFile4)
    })
    it('should not return static file if the path in element has changed', () => {
      expect(result).not.toContain(staticFile5)
    })
  })
})
