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
import { Workspace, parser, errors as wsErrors, parseCache, state, nacl, staticFiles, dirStore, pathIndex, loadWorkspace, EnvironmentsSources } from '@salto-io/workspace'
import { ElemID, SaltoError } from '@salto-io/adapter-api'


//RB const { parse } = parser
//RB const { mergeElements } = merger
//RB const SERVICES = ['salesforce']

//RB const configID = new ElemID(SERVICES[0])
//RB const mockConfigType = new ObjectType({
//RB   elemID: configID,
//RB   fields: { username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) } },
//RB })
//RB const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
//RB   username: 'test@test',
//RB })

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
})

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
  const commonNaclFilesSource = nacl.naclFilesSource(
    mockedDirStore,
    mockParseCache(),
    staticFiles.buildStaticFilesSource(
      mockDirStore(Object.fromEntries(staticFileNames.map(f => [f, Buffer.from(f)]))),
      mockStaticFilesCache
    )
  )
  const elementsSources = {
    commonSourceName: '',
    sources: {
      '': {
        naclFiles: commonNaclFilesSource,
      },
      default: {
        naclFiles: nacl.naclFilesSource(
          mockDirStore({}),
          mockParseCache(),
          staticFiles.buildStaticFilesSource(
            mockDirStore({}),
            mockStaticFilesCache
          )
        ),
        state: state.buildInMemState(async () => ({
          elements: _.keyBy(await commonNaclFilesSource.getAll(), e => e.elemID.getFullName()),
          pathIndex: new pathIndex.PathIndex(),
          servicesUpdateDate: {},
          saltoVersion: '0.0.1',
        })),
      },
      inactive: {
        naclFiles: nacl.naclFilesSource(
          mockDirStore({}),
          mockParseCache(),
          staticFiles.buildStaticFilesSource(
            mockDirStore({}),
            mockStaticFilesCache
          )
        ),
        state: state.buildInMemState(async () => ({
          elements: {},
          pathIndex: new pathIndex.PathIndex(),
          servicesUpdateDate: {},
          saltoVersion: '0.0.1',
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
  return loadWorkspace(mockConfSource, mockCredentialsSource, elementsSources)
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
