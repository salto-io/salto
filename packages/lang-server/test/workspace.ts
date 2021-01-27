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
import * as path from 'path'
import { readFileSync } from 'fs'
import _ from 'lodash'
<<<<<<< HEAD
import { Workspace, parser, errors as wsErrors, parseCache, state, nacl, staticFiles, dirStore,
  loadWorkspace, EnvironmentsSources, remoteMap, elementSource } from '@salto-io/workspace'
import { ElemID, SaltoError } from '@salto-io/adapter-api'
=======
import { Workspace, parser, errors as wsErrors,
  merger, configSource as cs, nacl, staticFiles, dirStore, elementSource } from '@salto-io/workspace'
import { ElemID, ObjectType, BuiltinTypes, InstanceElement, SaltoError } from '@salto-io/adapter-api'

>>>>>>> 435904a9... New impl no rename and clone
import { collections } from '@salto-io/lowerdash'

const { toAsyncIterable } = collections.asynciterable
const { createInMemoryElementSource } = elementSource
const { InMemoryRemoteMap } = remoteMap
type RemoteMapEntry<T, K extends string> = remoteMap.RemoteMapEntry<T, K>
type CreateRemoteMapParams<T> = remoteMap.CreateRemoteMapParams<T>
type RemoteMap<T, K extends string> = remoteMap.RemoteMap<T, K>
const { awu } = collections.asynciterable

// RB const { parse } = parser
// RB const { mergeElements } = merger
// RB const SERVICES = ['salesforce']

// RB const configID = new ElemID(SERVICES[0])
// RB const mockConfigType = new ObjectType({
// RB   elemID: configID,
// RB   fields: { username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) } },
// RB })
// RB const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
// RB   username: 'test@test',
// RB })

export const mockErrors = (
  errors: SaltoError[], parseErrors: parser.ParseError[] = []
): wsErrors.Errors => ({
  all: () => [...errors, ...parseErrors],
  hasErrors: () => errors.length !== 0,
  merge: [],
  parse: parseErrors,
  validation: errors.map(err => ({ elemID: new ElemID('test'), error: '', ...err })),
  strings: () => errors.map(err => err.message),
})

export const mockFunction = <T extends (...args: never[]) => unknown>():
jest.Mock<ReturnType<T>, Parameters<T>> => jest.fn()

const mockDirStore = <T extends dirStore.ContentType>(files: Record<string, T> = {}):
dirStore.SyncDirectoryStore<T> => {
  let naclFiles = _.mapValues(
    files,
    (buffer, filename) => ({ filename, buffer })
  )
  return {
    list: mockFunction<dirStore.SyncDirectoryStore<T>['list']>().mockImplementation(async () => Object.keys(naclFiles)),
    get: mockFunction<dirStore.SyncDirectoryStore<T>['get']>().mockImplementation(async filepath => naclFiles[filepath]),
    set: mockFunction<dirStore.SyncDirectoryStore<T>['set']>().mockImplementation(async file => { naclFiles[file.filename] = file }),
    delete: mockFunction<dirStore.SyncDirectoryStore<T>['delete']>().mockImplementation(async filepath => { delete naclFiles[filepath] }),
    clear: mockFunction<dirStore.SyncDirectoryStore<T>['clear']>().mockImplementation(async () => { naclFiles = {} }),
    rename: mockFunction<dirStore.SyncDirectoryStore<T>['rename']>(),
    renameFile: mockFunction<dirStore.SyncDirectoryStore<T>['renameFile']>(),
    flush: mockFunction<dirStore.SyncDirectoryStore<T>['flush']>(),
    mtimestamp: mockFunction<dirStore.SyncDirectoryStore<T>['mtimestamp']>().mockResolvedValue(0),
    getFiles: mockFunction<dirStore.SyncDirectoryStore<T>['getFiles']>().mockImplementation(async filenames => filenames.map(name => naclFiles[name])),
    getTotalSize: mockFunction<dirStore.SyncDirectoryStore<T>['getTotalSize']>(),
    clone: mockFunction<dirStore.SyncDirectoryStore<T>['clone']>(),
    isEmpty: mockFunction<dirStore.SyncDirectoryStore<T>['isEmpty']>(),
    getFullPath: mockFunction<dirStore.SyncDirectoryStore<T>['getFullPath']>().mockImplementation(filepath => `full-${filepath}`),
    getSync: mockFunction<dirStore.SyncDirectoryStore<T>['getSync']>(),
  }
}

const mockParseCache = (): parseCache.ParseResultCache => ({
  put: () => Promise.resolve(),
  get: () => Promise.resolve(undefined),
  flush: () => Promise.resolve(undefined),
  clear: () => Promise.resolve(),
  rename: () => Promise.resolve(),
  clone: () => mockParseCache(),
  delete: () => Promise.resolve(),
  list: () => Promise.resolve([]),
})

const mockCreateRemoteMap = async <T, K extends string = string>(
  opts: CreateRemoteMapParams<T>
): Promise<RemoteMap<T, K>> => {
  let data: Record<K, string> = {} as Record<K, string>
  return {
    setAll: async (
      entries: collections.asynciterable.ThenableIterable<RemoteMapEntry<T, K>>
    ): Promise<void> => {
      for await (const entry of entries) {
        data[entry.key] = opts.serialize(entry.value)
      }
    },
    delete: async (key: K) => {
      delete data[key]
    },
    deleteAll: async () => {
      data = {} as Record<K, string>
    },
    get: async (key: K): Promise<T | undefined> => {
      const value = data[key]
      return value ? opts.deserialize(value) : undefined
    },
    has: async (key: K): Promise<boolean> => key in data,
    set: async (key: K, value: T): Promise<void> => {
      data[key] = opts.serialize(value)
    },
    clear: async (): Promise<void> => {
      data = {} as Record<K, string>
    },
    entries: (): AsyncIterable<RemoteMapEntry<T, K>> =>
      awu(Object.entries(data))
        .map(async ([key, value]) =>
          ({ key: key as K, value: await opts.deserialize(value as string) })),
    keys: (): AsyncIterable<K> => toAsyncIterable(Object.keys(data) as unknown as K[]),
    values: (): AsyncIterable<T> =>
      awu(Object.values(data)).map(async v => opts.deserialize(v as string)),
    flush: (): Promise<void> => Promise.resolve(undefined),
    revert: (): Promise<void> => Promise.resolve(undefined),
    close: (): Promise<void> => Promise.resolve(undefined),
  }
}

const buildMockWorkspace = async (files: Record<string, string>, staticFileNames: string[]):
Promise<Workspace> => {
  const mockStaticFilesCache: staticFiles.StaticFilesCache = {
    get: mockFunction<staticFiles.StaticFilesCache['get']>(),
    put: mockFunction<staticFiles.StaticFilesCache['put']>(),
    flush: mockFunction<staticFiles.StaticFilesCache['flush']>(),
    clear: mockFunction<staticFiles.StaticFilesCache['clear']>(),
    rename: mockFunction<staticFiles.StaticFilesCache['rename']>(),
    clone: mockFunction<staticFiles.StaticFilesCache['clone']>(),
  }

  const mockedDirStore = mockDirStore(files)
  const commonNaclFilesSource = await nacl.naclFilesSource(
    '',
    mockedDirStore,
    mockParseCache(),
    staticFiles.buildStaticFilesSource(
      mockDirStore(Object.fromEntries(staticFileNames.map(f => [f, Buffer.from(f)]))),
      mockStaticFilesCache
    ),
    mockCreateRemoteMap
  )
  const elementsSources = {
    commonSourceName: '',
    sources: {
      '': {
        naclFiles: commonNaclFilesSource,
      },
      default: {
        naclFiles: await nacl.naclFilesSource(
          'default',
          mockDirStore({}),
          mockParseCache(),
          staticFiles.buildStaticFilesSource(
            mockDirStore({}),
            mockStaticFilesCache
          ),
          mockCreateRemoteMap
        ),
        state: state.buildInMemState(async () => ({
          elements: createInMemoryElementSource(
            await awu(await commonNaclFilesSource.getAll()).toArray()
          ),
          pathIndex: new InMemoryRemoteMap(),
          servicesUpdateDate: new InMemoryRemoteMap(),
          saltoVersion: '0.0.1',
          saltoMetadata: new InMemoryRemoteMap(),
        })),
      },
      inactive: {
        naclFiles: await nacl.naclFilesSource(
          'inactive',
          mockDirStore({}),
          mockParseCache(),
          staticFiles.buildStaticFilesSource(
            mockDirStore({}),
            mockStaticFilesCache
          ),
          mockCreateRemoteMap
        ),
        state: state.buildInMemState(async () => ({
          elements: createInMemoryElementSource([]),
          pathIndex: new InMemoryRemoteMap(),
          servicesUpdateDate: new InMemoryRemoteMap(),
          saltoVersion: '0.0.1',
          saltoMetadata: new InMemoryRemoteMap(),
        })),
      },
    },
  } as EnvironmentsSources
  const mockConfSource = {
    getWorkspaceConfig: jest.fn().mockImplementation(() => ({
      envs: [
        { name: 'default', services: [] },
        { name: 'inactive', services: [] },
      ],
      uid: '',
      name: 'test',
      currentEnv: 'default',
    })),
<<<<<<< HEAD
    setWorkspaceConfig: jest.fn(),
    getAdapter: jest.fn(),
    setAdapter: jest.fn(),
  }
  const mockCredentialsSource = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
  }
  return loadWorkspace(mockConfSource, mockCredentialsSource, elementsSources, mockCreateRemoteMap)
=======
    setNaclFiles: mockFunction<Workspace['setNaclFiles']>().mockResolvedValue(),
    removeNaclFiles: mockFunction<Workspace['removeNaclFiles']>().mockResolvedValue(),
    listNaclFiles: mockFunction<Workspace['listNaclFiles']>().mockResolvedValue([filename]),
    getParsedNaclFile: mockFunction<Workspace['getParsedNaclFile']>().mockImplementation(async () => {
      const elements = elementSource.createInMemoryElementSource()
      await elements.setAll(merged.merged.values())
      return {
        elements,
        filename: '',
        data: {
          timestamp: 0,
          errors: [],
          referenced: [],
        },
      }
    }),
    getElementReferencedFiles: mockFunction<Workspace['getElementReferencedFiles']>().mockResolvedValue([filename]),
    getElementNaclFiles: mockFunction<Workspace['getElementNaclFiles']>().mockResolvedValue([filename]),
    clone: mockFunction<Workspace['clone']>().mockImplementation(() => Promise.resolve(buildMockWorkspace(naclFile, buffer))),
  } as unknown as Workspace
>>>>>>> 435904a9... New impl no rename and clone
}

export const mockWorkspace = async (naclFiles: string[] = [], staticFileNames: string[] = []):
Promise<Workspace> =>
  buildMockWorkspace(
    Object.fromEntries(
      naclFiles
        .map(file => [path.basename(file), readFileSync(file, { encoding: 'utf8' }) ?? 'blabla'])
    ),
    staticFileNames,
  )
