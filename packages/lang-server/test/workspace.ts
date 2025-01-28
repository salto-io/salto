/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

const { createInMemoryElementSource } = elementSource
const { InMemoryRemoteMap } = remoteMap
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
  strings: () => errors.map(err => err.detailedMessage),
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

const buildMockWorkspace = async (
  files: Record<string, string>,
  staticFileNames: string[],
  persistent = false,
): Promise<Workspace> => {
  const mockStaticFilesCache: staticFiles.StaticFilesCache = {
    list: mockFunction<staticFiles.StaticFilesCache['list']>(),
    get: mockFunction<staticFiles.StaticFilesCache['get']>(),
    put: mockFunction<staticFiles.StaticFilesCache['put']>(),
    putMany: mockFunction<staticFiles.StaticFilesCache['putMany']>(),
    delete: mockFunction<staticFiles.StaticFilesCache['delete']>(),
    deleteMany: mockFunction<staticFiles.StaticFilesCache['deleteMany']>(),
    flush: mockFunction<staticFiles.StaticFilesCache['flush']>(),
    clear: mockFunction<staticFiles.StaticFilesCache['clear']>(),
    rename: mockFunction<staticFiles.StaticFilesCache['rename']>(),
    clone: mockFunction<staticFiles.StaticFilesCache['clone']>(),
  }

  const mockedDirStore = mockDirStore(files)
  const mockCreateRemoteMap = remoteMap.inMemRemoteMapCreator()
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
          accounts: new InMemoryRemoteMap([{ key: 'account_names', value: [] }]),
          saltoVersion: '0.0.1',
          saltoMetadata: new InMemoryRemoteMap(),
          staticFilesSource: staticFiles.buildStaticFilesSource(mockDirStore({}), mockStaticFilesCache),
          deprecated: {
            accountsUpdateDate: new InMemoryRemoteMap<Date>(),
          },
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
          accounts: new InMemoryRemoteMap([{ key: 'account_names', value: [] }]),
          saltoVersion: '0.0.1',
          saltoMetadata: new InMemoryRemoteMap(),
          staticFilesSource: staticFiles.buildStaticFilesSource(mockDirStore({}), mockStaticFilesCache),
          deprecated: {
            accountsUpdateDate: new InMemoryRemoteMap<Date>(),
          },
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
  return loadWorkspace({
    config: mockConfSource,
    adaptersConfig: mockAdaptersConf,
    credentials: mockCredentialsSource,
    environmentsSources: elementsSources,
    remoteMapCreator: mockCreateRemoteMap,
    adapterCreators: {},
  })
}

export const mockWorkspace = async (naclFiles: string[] = [], staticFileNames: string[] = []): Promise<Workspace> =>
  buildMockWorkspace(
    Object.fromEntries(
      naclFiles.map(file => [path.basename(file), readFileSync(file, { encoding: 'utf8' }) ?? 'blabla']),
    ),
    staticFileNames,
  )
