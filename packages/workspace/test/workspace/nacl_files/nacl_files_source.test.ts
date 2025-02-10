/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  isStaticFile,
  DetailedChangeWithBaseChange,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { parser } from '@salto-io/parser'
import { detailedCompare, toDetailedChangeFromBaseChange, transformElement } from '@salto-io/adapter-utils'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource, MissingStaticFile } from '../../../src/workspace/static_files'
import { ParsedNaclFileCache, createParseResultCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'

import {
  InMemoryRemoteMap,
  RemoteMap,
  CreateRemoteMapParams,
  inMemRemoteMapCreator,
} from '../../../src/workspace/remote_map'
import { mockStaticFilesSource } from '../../utils'
import { ParsedNaclFile } from '../../../src/workspace/nacl_files/parsed_nacl_file'
import * as naclFileSourceModule from '../../../src/workspace/nacl_files/nacl_files_source'
import { mockDirStore as createMockDirStore } from '../../common/nacl_file_store'
import {
  getDanglingStaticFiles,
  // Importing getElementsStaticFiles since this file is the only place it's used but it's only referenced by name for spying
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getElementsStaticFiles as _getElementsStaticFiles,
} from '../../../src/workspace/nacl_files/nacl_files_source'
import { DetailedChangeWithSource, getChangeLocations } from '../../../src/workspace/nacl_files/nacl_file_update'

const { awu } = collections.asynciterable

const createChange = (): DetailedChangeWithBaseChange => {
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
  const change: DetailedChangeWithBaseChange = {
    ...toDetailedChangeFromBaseChange(toChange({ after: newElem })),
    path: ['new', 'file'],
  }
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

describe.each([false, true])(
  'Nacl Files Source (CREATE_FILENAMES_TO_ELEMENT_IDS_MAPPING is %s)',
  shouldCreateFilenamesToElementIDsMapping => {
    let getChangeLocationsMock: jest.MockedFunction<typeof getChangeLocations>
    let mockDirStore: MockInterface<DirectoryStore<string>>
    let mockCache: ParsedNaclFileCache
    let mockedStaticFilesSource: StaticFilesSource

    let createdMaps: Record<string, RemoteMap<Value>> = {}
    const mockRemoteMapCreator = {
      close: async () => {},
      create: async <T, K extends string = string>({
        namespace,
      }: Pick<CreateRemoteMapParams<T>, 'namespace'>): Promise<RemoteMap<T, K>> => {
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
            deleteAll: mockFunction<RemoteMap<Value>['deleteAll']>().mockImplementation(
              realMap.deleteAll.bind(realMap),
            ),
            entries: mockFunction<RemoteMap<Value>['entries']>().mockImplementation(realMap.entries.bind(realMap)),
            keys: mockFunction<RemoteMap<Value>['keys']>().mockImplementation(realMap.keys.bind(realMap)),
            values: mockFunction<RemoteMap<Value>['values']>().mockImplementation(realMap.values.bind(realMap)),
            flush: mockFunction<RemoteMap<Value>['flush']>().mockImplementation(realMap.flush.bind(realMap)),
            clear: mockFunction<RemoteMap<Value>['clear']>().mockImplementation(realMap.clear.bind(realMap)),
            close: mockFunction<RemoteMap<Value>['close']>().mockImplementation(realMap.close.bind(realMap)),
            isEmpty: mockFunction<RemoteMap<Value>['isEmpty']>().mockImplementation(realMap.isEmpty.bind(realMap)),
          }
        }
        return createdMaps[namespace] as RemoteMap<T, K>
      },
    }

    beforeEach(async () => {
      jest.clearAllMocks()
      createdMaps = {}
      mockDirStore = createMockDirStore([], true)
      mockedStaticFilesSource = mockStaticFilesSource()
      mockCache = createParseResultCache('test', inMemRemoteMapCreator(), mockStaticFilesSource(), true)
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

    beforeAll(() => {
      process.env.SALTO_CREATE_FILENAMES_TO_ELEMENT_IDS_MAPPING = shouldCreateFilenamesToElementIDsMapping ? '1' : '0'
    })

    afterAll(() => {
      delete process.env.SALTO_CREATE_FILENAMES_TO_ELEMENT_IDS_MAPPING
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
      const deprecatedReferencedIndexes = [
        'naclFileSource--referenced_index',
        'parsedResultCache-naclFileSource--parsed_nacl_files-referenced',
      ]

      it('should flush everything by default', async () => {
        mockDirStore.flush = jest.fn().mockResolvedValue(Promise.resolve())
        mockCache.clear = jest.fn().mockResolvedValue(Promise.resolve())
        mockedStaticFilesSource.clear = jest.fn().mockResolvedValue(Promise.resolve())
        const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, mockRemoteMapCreator, true)
        await naclSrc.load({})
        await naclSrc.flush()
        expect(mockDirStore.flush as jest.Mock).toHaveBeenCalledTimes(1)
        Object.entries(createdMaps).forEach(([name, cache]) => {
          if (!deprecatedReferencedIndexes.includes(name)) {
            expect(cache.flush).toHaveBeenCalledTimes(1)
          }
        })
        expect(mockedStaticFilesSource.flush).toHaveBeenCalledTimes(1)
      })

      it('should clear&flush referenced_index if it is not empty', async () => {
        const wrappedRemoteMapCreator = {
          close: async () => {},
          create: async <T, K extends string = string>({
            namespace,
          }: CreateRemoteMapParams<T>): Promise<RemoteMap<T, K>> => {
            const remoteMapCreator = await mockRemoteMapCreator.create({ namespace })
            if (deprecatedReferencedIndexes.includes(namespace)) {
              ;(remoteMapCreator.isEmpty as jest.Mock).mockResolvedValue(false)
            }
            return remoteMapCreator as RemoteMap<T, K>
          },
        }
        const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, wrappedRemoteMapCreator, true)
        await naclSrc.load({})
        await naclSrc.flush()
        deprecatedReferencedIndexes.forEach(namespace => {
          expect(createdMaps[namespace].clear).toHaveBeenCalled()
          expect(createdMaps[namespace].flush).toHaveBeenCalled()
        })
      })

      it('should not clear&flush referenced_index if it is empty', async () => {
        const wrappedRemoteMapCreator = {
          close: async () => {},
          create: async <T, K extends string = string>({
            namespace,
          }: CreateRemoteMapParams<T>): Promise<RemoteMap<T, K>> => {
            const remoteMapCreator = await mockRemoteMapCreator.create({ namespace })
            if (deprecatedReferencedIndexes.includes(namespace)) {
              ;(remoteMapCreator.isEmpty as jest.Mock).mockResolvedValue(true)
            }
            return remoteMapCreator as RemoteMap<T, K>
          },
        }
        const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, wrappedRemoteMapCreator, true)
        await naclSrc.load({})
        await naclSrc.flush()
        deprecatedReferencedIndexes.forEach(namespace => {
          expect(createdMaps[namespace].clear).not.toHaveBeenCalled()
          expect(createdMaps[namespace].flush).not.toHaveBeenCalled()
        })
      })
    })

    describe('isEmpty', () => {
      it("should use store's isEmpty", async () => {
        mockDirStore.isEmpty = jest.fn().mockResolvedValue(Promise.resolve())
        const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
        await naclSrc.load({})
        await naclSrc.isEmpty()
        expect(mockDirStore.isEmpty as jest.Mock).toHaveBeenCalledTimes(1)
      })
    })

    describe('load', () => {
      it('should list files', async () => {
        mockDirStore.list = jest.fn().mockResolvedValue(Promise.resolve([]))
        await (await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)).load({})
        expect(mockDirStore.list as jest.Mock).toHaveBeenCalled()
      })
      it('should not list files if ignoreFileChanges is set', async () => {
        mockDirStore.list = jest.fn().mockImplementation(async () => awu([]))
        await (
          await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
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
            {
              close: async () => {},
              create: <T, K extends string>() => {
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
        const naclSrc = await naclFilesSource(
          oldName,
          mockDirStore,
          mockedStaticFilesSource,
          mockRemoteMapCreator,
          true,
        )
        await naclSrc.load({})
        jest.clearAllMocks()
        await naclSrc.rename(newName)
        expect(mockDirStore.rename).toHaveBeenCalledTimes(1)
        expect(mockDirStore.rename).toHaveBeenCalledWith(newName)
        expect(mockedStaticFilesSource.rename).toHaveBeenCalledTimes(1)
        expect(mockedStaticFilesSource.rename).toHaveBeenCalledWith(newName)

        const cacheKeysToRename = ['elements_index', 'metadata', 'searchableNamesIndex']
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
          await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
        ).getTotalSize()
        expect(totalSize).toEqual(300)
        expect(mockDirStore.getTotalSize).toHaveBeenCalledTimes(1)
        expect(mockedStaticFilesSource.getTotalSize).toHaveBeenCalledTimes(1)
      })
    })

    describe('parse optimization', () => {
      const change = createChange()
      it('should not parse file when updating single add changes in a new file', async () => {
        const naclSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
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
        src = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
        await src.load({})
      })
      it('should not parse file when updating single add changes in a new file', async () => {
        const baseChange = toChange({
          before: new ObjectType({ elemID, annotations: { file: sfile } }),
          after: new ObjectType({ elemID }),
        })
        const change = {
          id: elemID.createNestedID('attr', 'file'),
          action: 'remove',
          data: { before: sfile },
          baseChange,
          path: ['new', 'file'],
        } as DetailedChangeWithBaseChange
        await src.updateNaclFiles([change])
        expect(mockedStaticFilesSource.delete).toHaveBeenCalledWith(sfile)
      })
      it('should delete before file when path is changed', async () => {
        const newFile = new StaticFile({ filepath: afterFilePath, hash: 'XI' })
        const baseChange = toChange({
          before: new ObjectType({ elemID, annotations: { file: sfile } }),
          after: new ObjectType({ elemID, annotations: { file: newFile } }),
        })
        const change = {
          id: elemID.createNestedID('attr', 'file'),
          action: 'modify',
          data: { before: sfile, after: newFile },
          baseChange,
          path: ['new', 'file'],
        } as DetailedChangeWithBaseChange
        await src.updateNaclFiles([change])
        expect(mockedStaticFilesSource.delete).toHaveBeenCalledWith(sfile)
      })
      it('should delete before file when it is no longer a static file', async () => {
        const baseChange = toChange({
          before: new ObjectType({ elemID, annotations: { file: sfile } }),
          after: new ObjectType({ elemID, annotations: { file: '' } }),
        })
        const change = {
          id: elemID,
          action: 'modify',
          data: { before: sfile, after: '' },
          baseChange,
          path: ['new', 'file'],
        } as DetailedChangeWithBaseChange
        await src.updateNaclFiles([change])
        expect(mockedStaticFilesSource.delete).toHaveBeenCalledWith(sfile)
      })
      it('should not delete static file if the change is only in content and not in path', async () => {
        const newFile = new StaticFile({ filepath, hash: 'XII' })
        const baseChange = toChange({
          before: new ObjectType({ elemID, annotations: { file: sfile } }),
          after: new ObjectType({ elemID, annotations: { file: newFile } }),
        })
        const change = {
          id: elemID,
          action: 'modify',
          data: { before: sfile, after: newFile },
          baseChange,
          path: ['new', 'file'],
        } as DetailedChangeWithBaseChange
        await src.updateNaclFiles([change])
        expect(mockedStaticFilesSource.delete).toHaveBeenCalledTimes(0)
      })
      it('should not delete static file if there are multiple appearances of it (in different files)', async () => {
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

        const newInstanceElement1 = new InstanceElement(
          'inst1',
          new ObjectType({ elemID: new ElemID('dummy', 'type') }),
          {
            file2: sfile,
          },
        )
        const newInstanceElement2 = new InstanceElement(
          'inst2',
          new ObjectType({ elemID: new ElemID('dummy', 'type') }),
          {
            file2: sfile,
          },
        )
        const detailedChange1 = {
          action: 'add',
          id: newInstanceElement1.elemID,
          data: { after: newInstanceElement1 },
        } as DetailedChangeWithBaseChange
        const detailedChange2 = {
          action: 'add',
          id: newInstanceElement2.elemID,
          data: { after: newInstanceElement2 },
        } as DetailedChangeWithBaseChange

        await src.updateNaclFiles([detailedChange1, detailedChange2])

        const removal = {
          id: newInstanceElement1.elemID.createNestedID('file'),
          action: 'remove',
          data: { before: sfile },
        } as DetailedChangeWithBaseChange
        await src.updateNaclFiles([removal])
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
        const someFile = new StaticFile({ filepath, hash: 'XII' })
        const anotherElemID = new ElemID('salesforce', 'new_elem2')
        const additionBaseChange = toChange({
          before: new ObjectType({ elemID: anotherElemID }),
          after: new ObjectType({ elemID: anotherElemID, annotations: { file: someFile } }),
        })
        const changeAdd = {
          id: anotherElemID.createNestedID('attr', 'file'),
          action: 'add',
          data: { after: someFile },
          baseChange: additionBaseChange,
          path: ['new', 'file'],
        } as DetailedChangeWithBaseChange
        const removalBaseChange = toChange({
          before: new ObjectType({ elemID, annotations: { file: someFile } }),
          after: new ObjectType({ elemID }),
        })
        const changeDelete = {
          id: elemID.createNestedID('attr', 'file'),
          action: 'remove',
          data: { before: someFile },
          baseChange: removalBaseChange,
          path: ['old', 'file2'],
        } as DetailedChangeWithBaseChange
        await src.updateNaclFiles([changeAdd, changeDelete])
        expect(mockedStaticFilesSource.delete).toHaveBeenCalledTimes(0)
      })
    })

    describe('getParsedNaclFile', () => {
      let naclSource: NaclFilesSource
      const mockFileData = { buffer: 'someData {}', filename: 'somefile.nacl' }

      beforeEach(async () => {
        naclSource = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
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

      it('should cache staticFiles result on parsedNaclFile', async () => {
        ;(mockDirStore.get as jest.Mock).mockResolvedValue(mockFileData)
        const elements = [new ObjectType({ elemID: new ElemID('dummy', 'elem') })]
        mockParse.mockResolvedValueOnce({ elements, errors: [] })
        const mockGetElementStaticFiles = jest.spyOn(naclFileSourceModule, 'getElementsStaticFiles')
        const parsed = await naclSource.getParsedNaclFile(mockFileData.filename)
        expect(parsed).toBeDefined()
        await parsed?.data.staticFiles()
        expect(mockGetElementStaticFiles).toHaveBeenCalled()
        mockGetElementStaticFiles.mockClear()
        await parsed?.data.staticFiles()
        expect(mockGetElementStaticFiles).not.toHaveBeenCalled()
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
        src = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
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
        src = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
        await src.load({})
        await src.updateNaclFiles([createChange()])
      })

      it('should list all searchable elements', async () => {
        expect(await src.getSearchableNames()).toEqual(['salesforce.new_elem', 'salesforce.new_elem.field.myField'])
      })
    })

    describe('non persistent naclFileSource', () => {
      it('should not allow flush when the ws is non-persistent', async () => {
        const nonPSrc = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), false)
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
        const src = await naclFilesSource('', mockDirStore, staticFileSource, inMemRemoteMapCreator(), false)
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
        src = await naclFilesSource('', mockDirStore, staticFileSource, inMemRemoteMapCreator(), false)
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
        const src1 = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
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
      const staticFile7 = new StaticFile({ filepath: 'path7', hash: 'hash7' })

      beforeAll(async () => {
        beforeElem = new InstanceElement('elem', new ObjectType({ elemID: new ElemID('salesforce', 'type') }), {
          f1: staticFile1, // To modify
          f2: staticFile2, // To remove
          f3: staticFile5, // To change location
          a: { f3: staticFile3 }, // To modify
          b: { f4: staticFile4 }, // To remove
          stays: staticFile7, // To stay
          remove: staticFile7, // To remove - shouldn't be returned
        })
        afterElem = beforeElem.clone()

        afterElem.value.f1 = staticFile6
        afterElem.value.f5 = staticFile5
        delete afterElem.value.f2
        delete afterElem.value.f3
        afterElem.value.a = 's'
        delete afterElem.value.b
        delete afterElem.value.remove

        const staticFilesIndex = {
          get: async (staticFile: string) => (staticFile !== 'path7' ? ['singleNaclPath'] : ['multi', 'naclPaths']),
        }
        result = await getDanglingStaticFiles(detailedCompare(beforeElem, afterElem), staticFilesIndex)
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
      it('should not return removed static file if it is still referenced in another field', () => {
        expect(result).not.toContain(staticFile7)
      })

      describe('when there are no static files in the changes before', () => {
        let mockStaticFilesIndex: Pick<RemoteMap<string[]>, 'get'>

        beforeAll(async () => {
          const beforeElemWithoutStaticFiles = await transformElement({
            element: beforeElem,
            strict: false,
            transformFunc: ({ value }) => (isStaticFile(value) ? undefined : value),
          })
          mockStaticFilesIndex = { get: jest.fn() }
          result = await getDanglingStaticFiles(
            detailedCompare(beforeElemWithoutStaticFiles, afterElem),
            mockStaticFilesIndex,
          )
        })
        it('should return empty list', () => {
          expect(result).toBeEmpty()
        })
        it('should not query staticFilesIndex', () => {
          expect(mockStaticFilesIndex.get).not.toHaveBeenCalled()
        })
      })
    })
  },
)
