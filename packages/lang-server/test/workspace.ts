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
import * as path from 'path'
import { readFileSync } from 'fs'
import _ from 'lodash'
import {
  Workspace,
  errors as wsErrors,
  state,
  nacl,
  staticFiles,
  dirStore,
  loadWorkspace,
  EnvironmentsSources,
  remoteMap,
  elementSource,
  pathIndex,
  adaptersConfigSource as acs,
} from '@salto-io/workspace'
import { parser } from '@salto-io/parser'
import { ElemID, SaltoError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'

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
// RB   fields: { username: { refType: BuiltinTypes.STRING } },
// RB })
// RB const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
// RB   username: 'test@test',
// RB })

export const mockErrors = (errors: SaltoError[], parseErrors: parser.ParseError[] = []): wsErrors.Errors => ({
  all: () => [...errors, ...parseErrors],
  hasErrors: () => errors.length !== 0,
  merge: [],
  parse: parseErrors,
  validation: errors.map(err => ({ elemID: new ElemID('test'), error: '', ...err })),
  strings: () => errors.map(err => err.message),
})

const mockDirStore = <T extends dirStore.ContentType>(files: Record<string, T> = {}): dirStore.DirectoryStore<T> => {
  let naclFiles = _.mapValues(files, (buffer, filename) => ({ filename, buffer }))
  return {
    list: mockFunction<dirStore.DirectoryStore<T>['list']>().mockImplementation(async () => Object.keys(naclFiles)),
    get: mockFunction<dirStore.DirectoryStore<T>['get']>().mockImplementation(async filepath => naclFiles[filepath]),
    set: mockFunction<dirStore.DirectoryStore<T>['set']>().mockImplementation(async file => {
      naclFiles[file.filename] = file
    }),
    delete: mockFunction<dirStore.DirectoryStore<T>['delete']>().mockImplementation(async filepath => {
      delete naclFiles[filepath]
    }),
    clear: mockFunction<dirStore.DirectoryStore<T>['clear']>().mockImplementation(async () => {
      naclFiles = {}
    }),
    rename: mockFunction<dirStore.DirectoryStore<T>['rename']>(),
    renameFile: mockFunction<dirStore.DirectoryStore<T>['renameFile']>(),
    flush: mockFunction<dirStore.DirectoryStore<T>['flush']>(),
    mtimestamp: mockFunction<dirStore.DirectoryStore<T>['mtimestamp']>().mockResolvedValue(0),
    getFiles: mockFunction<dirStore.DirectoryStore<T>['getFiles']>().mockImplementation(async filenames =>
      filenames.map(name => naclFiles[name]),
    ),
    getTotalSize: mockFunction<dirStore.DirectoryStore<T>['getTotalSize']>(),
    clone: mockFunction<dirStore.DirectoryStore<T>['clone']>(),
    isEmpty: mockFunction<dirStore.DirectoryStore<T>['isEmpty']>(),
    getFullPath: mockFunction<dirStore.DirectoryStore<T>['getFullPath']>().mockImplementation(
      filepath => `full-${filepath}`,
    ),
    isPathIncluded: mockFunction<dirStore.DirectoryStore<T>['isPathIncluded']>(),
    exists: mockFunction<dirStore.DirectoryStore<T>['exists']>(),
  }
}

const persistentMockCreateRemoteMap = (): (<T, K extends string = string>(
  opts: CreateRemoteMapParams<T>,
) => Promise<RemoteMap<T, K>>) => {
  const maps = {} as Record<string, Record<string, string>>
  const creator = async <T, K extends string = string>(opts: CreateRemoteMapParams<T>): Promise<RemoteMap<T, K>> => {
    if (maps[opts.namespace] === undefined) {
      maps[opts.namespace] = {} as Record<string, string>
    }
    const get = async (key: K): Promise<T | undefined> => {
      const value = maps[opts.namespace][key]
      return value ? opts.deserialize(value) : undefined
    }
    return {
      setAll: async (entries: collections.asynciterable.ThenableIterable<RemoteMapEntry<T, K>>): Promise<void> => {
        for await (const entry of entries) {
          maps[opts.namespace][entry.key] = await opts.serialize(entry.value)
        }
      },
      delete: async (key: K) => {
        delete maps[opts.namespace][key]
      },
      deleteAll: async (keys: collections.asynciterable.ThenableIterable<K>) => {
        for await (const key of keys) {
          delete maps[opts.namespace][key]
        }
      },
      get,
      getMany: async (keys: K[]): Promise<(T | undefined)[]> => Promise.all(keys.map(get)),
      has: async (key: K): Promise<boolean> => key in maps[opts.namespace],
      set: async (key: K, value: T): Promise<void> => {
        maps[opts.namespace][key] = await opts.serialize(value)
      },
      clear: async (): Promise<void> => {
        maps[opts.namespace] = {} as Record<K, string>
      },
      entries: (): AsyncIterable<RemoteMapEntry<T, K>> =>
        awu(Object.entries(maps[opts.namespace])).map(async ([key, value]) => ({
          key: key as K,
          value: await opts.deserialize(value as string),
        })),
      keys: (): AsyncIterable<K> => toAsyncIterable(Object.keys(maps[opts.namespace]) as unknown as K[]),
      values: (): AsyncIterable<T> =>
        awu(Object.values(maps[opts.namespace])).map(async v => opts.deserialize(v as string)),
      flush: (): Promise<boolean> => Promise.resolve(false),
      revert: (): Promise<void> => Promise.resolve(undefined),
      close: (): Promise<void> => Promise.resolve(undefined),
      isEmpty: (): Promise<boolean> => Promise.resolve(_.isEmpty(maps[opts.namespace])),
    }
  }
  return creator
}

const buildMockWorkspace = async (
  files: Record<string, string>,
  staticFileNames: string[],
  persistent = false,
): Promise<Workspace> => {
  const mockStaticFilesCache: staticFiles.StaticFilesCache = {
    list: mockFunction<staticFiles.StaticFilesCache['list']>(),
    get: mockFunction<staticFiles.StaticFilesCache['get']>(),
    put: mockFunction<staticFiles.StaticFilesCache['put']>(),
    flush: mockFunction<staticFiles.StaticFilesCache['flush']>(),
    clear: mockFunction<staticFiles.StaticFilesCache['clear']>(),
    rename: mockFunction<staticFiles.StaticFilesCache['rename']>(),
    clone: mockFunction<staticFiles.StaticFilesCache['clone']>(),
  }

  const mockedDirStore = mockDirStore(files)
  const mockCreateRemoteMap = persistentMockCreateRemoteMap()
  const commonStaticFilesSource = staticFiles.buildStaticFilesSource(
    mockDirStore(Object.fromEntries(staticFileNames.map(f => [f, Buffer.from(f)]))),
    mockStaticFilesCache,
  )
  const commonNaclFilesSource = await nacl.naclFilesSource(
    '',
    mockedDirStore,
    commonStaticFilesSource,
    mockCreateRemoteMap,
    persistent,
  )
  const defaultStaticFilesSource = staticFiles.buildStaticFilesSource(mockDirStore({}), mockStaticFilesCache)
  const inactiveStaticFilesSource = staticFiles.buildStaticFilesSource(mockDirStore({}), mockStaticFilesCache)

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
          defaultStaticFilesSource,
          mockCreateRemoteMap,
          persistent,
        ),
        state: state.buildInMemState(async () => ({
          elements: createInMemoryElementSource(await awu(await commonNaclFilesSource.getAll()).toArray()),
          pathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
          topLevelPathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
          accountsUpdateDate: new InMemoryRemoteMap(),
          saltoVersion: '0.0.1',
          saltoMetadata: new InMemoryRemoteMap(),
          staticFilesSource: staticFiles.buildStaticFilesSource(mockDirStore({}), mockStaticFilesCache),
        })),
      },
      inactive: {
        naclFiles: await nacl.naclFilesSource(
          'inactive',
          mockDirStore({}),
          inactiveStaticFilesSource,
          mockCreateRemoteMap,
          persistent,
        ),
        state: state.buildInMemState(async () => ({
          elements: createInMemoryElementSource([]),
          pathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
          topLevelPathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
          accountsUpdateDate: new InMemoryRemoteMap(),
          saltoVersion: '0.0.1',
          saltoMetadata: new InMemoryRemoteMap(),
          staticFilesSource: staticFiles.buildStaticFilesSource(mockDirStore({}), mockStaticFilesCache),
        })),
      },
    },
  } as EnvironmentsSources
  const mockConfSource = {
    getWorkspaceConfig: jest.fn().mockImplementation(() => ({
      envs: [
        { name: 'default', accounts: [], accountToServiceName: {} },
        { name: 'inactive', accounts: [], accountToServiceName: {} },
      ],
      uid: '',
      name: 'test',
      currentEnv: 'default',
    })),
    setWorkspaceConfig: jest.fn(),
  }
  const mockAdaptersConf = {
    getAdapter: mockFunction<acs.AdaptersConfigSource['getAdapter']>(),
    setAdapter: mockFunction<acs.AdaptersConfigSource['setAdapter']>(),
    getElementNaclFiles: mockFunction<acs.AdaptersConfigSource['getElementNaclFiles']>(),
    getErrors: mockFunction<acs.AdaptersConfigSource['getErrors']>().mockResolvedValue(mockErrors([])),
    getSourceRanges: mockFunction<acs.AdaptersConfigSource['getSourceRanges']>(),
    getNaclFile: mockFunction<acs.AdaptersConfigSource['getNaclFile']>(),
    setNaclFiles: mockFunction<acs.AdaptersConfigSource['setNaclFiles']>(),
    flush: mockFunction<acs.AdaptersConfigSource['flush']>(),
    getElements: mockFunction<acs.AdaptersConfigSource['getElements']>(),
    getParsedNaclFile: mockFunction<acs.AdaptersConfigSource['getParsedNaclFile']>(),
    getSourceMap: mockFunction<acs.AdaptersConfigSource['getSourceMap']>(),
    listNaclFiles: mockFunction<acs.AdaptersConfigSource['listNaclFiles']>().mockResolvedValue([]),
    isConfigFile: mockFunction<acs.AdaptersConfigSource['isConfigFile']>(),
  }
  const mockCredentialsSource = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
  }
  return loadWorkspace(mockConfSource, mockAdaptersConf, mockCredentialsSource, elementsSources, mockCreateRemoteMap)
}

export const mockWorkspace = async (naclFiles: string[] = [], staticFileNames: string[] = []): Promise<Workspace> =>
  buildMockWorkspace(
    Object.fromEntries(
      naclFiles.map(file => [path.basename(file), readFileSync(file, { encoding: 'utf8' }) ?? 'blabla']),
    ),
    staticFileNames,
  )
