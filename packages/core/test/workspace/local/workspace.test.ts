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
import path from 'path'
import { Adapter, ElemID, GetCustomReferencesFunc, InstanceElement, ObjectType, Value } from '@salto-io/adapter-api'
import * as ws from '@salto-io/workspace'
import * as file from '@salto-io/file'
import { EnvironmentsSources, configSource as cs } from '@salto-io/workspace'
import { collections, values } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import { mockAdaptersConfigSource } from '@salto-io/workspace/test/common/workspace'
import {
  initLocalWorkspace,
  ExistingWorkspaceError,
  NotAnEmptyWorkspaceError,
  NotAWorkspaceError,
  loadLocalWorkspace,
  CREDENTIALS_CONFIG_PATH,
  loadLocalElementsSources,
  locateWorkspaceRoot,
  getCustomReferences,
} from '../../../src/local-workspace/workspace'
import { getSaltoHome } from '../../../src/app_config'
import * as mockDirStore from '../../../src/local-workspace/dir_store'
import { adapterCreators } from '../../../src/core/adapters'
import { mockStaticFilesSource } from '../../common/state'

const { awu } = collections.asynciterable
const { ENVS_PREFIX } = ws.nacl
const { COMMON_ENV_PREFIX } = ws

const mockRemoteMapCreator = async <T, K extends string = string>(
  _opts: ws.remoteMap.CreateRemoteMapParams<T>,
): Promise<ws.remoteMap.RemoteMap<T, K>> => new ws.remoteMap.InMemoryRemoteMap<T, K>()

const mockConfigSource = (): jest.Mocked<cs.ConfigSource> => ({
  get: mockFunction<cs.ConfigSource['get']>(),
  set: mockFunction<cs.ConfigSource['set']>(),
  delete: mockFunction<cs.ConfigSource['delete']>(),
  rename: mockFunction<cs.ConfigSource['rename']>(),
})

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual<{}>('@salto-io/file'),
  exists: jest.fn(),
  rm: jest.fn(),
  isEmptyDir: {
    notFoundAsUndefined: jest.fn(() => true),
  },
}))
jest.mock('@salto-io/workspace', () => ({
  ...jest.requireActual<{}>('@salto-io/workspace'),
  buildStaticFilesCache: () => ({
    rename: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
  }),
  initWorkspace: jest.fn(),
  loadWorkspace: jest.fn(),
}))
jest.mock('../../../src/local-workspace/dir_store')
jest.mock('../../../src/local-workspace/remote_map', () => ({
  ...jest.requireActual<{}>('../../../src/local-workspace/remote_map'),
  createRemoteMapCreator: () => mockRemoteMapCreator,
}))
describe('local workspace', () => {
  const mockExists = file.exists as jest.Mock
  const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
  const mockDirStoreInstance = (): ws.dirStore.DirectoryStore<string> =>
    ({
      get: jest.fn().mockResolvedValue({ buffer: '', filename: '' }),
      set: jest.fn(),
      flush: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      mtimestamp: jest.fn(),
      getFiles: jest.fn(),
      clone: jest.fn(),
      isEmpty: jest.fn().mockResolvedValue(true),
      rename: jest.fn(),
    }) as unknown as ws.dirStore.DirectoryStore<string>
  const repoDirStore = mockDirStoreInstance()
  const localDirStore = mockDirStoreInstance()
  const envDirStore = mockDirStoreInstance()
  mockCreateDirStore.mockImplementation(params => {
    if (params.baseDir.startsWith(getSaltoHome())) {
      return localDirStore
    }
    return params.name?.includes(ENVS_PREFIX) ? envDirStore : repoDirStore
  })
  const toWorkspaceRelative = (params: { baseDir: string; name: string }): string => {
    const dir = path.join(...[params.baseDir, params.name].filter(values.isDefined))
    return dir.startsWith(getSaltoHome())
      ? path.relative(getSaltoHome(), dir)
      : `${path.basename(path.dirname(dir))}${path.sep}${path.basename(dir)}`
  }
  beforeEach(() => jest.clearAllMocks())

  describe('locateWorkspaceRoot', () => {
    it('should return undefined if no workspaceRoot exists in path', async () => {
      mockExists.mockResolvedValue(false)
      const workspacePath = await locateWorkspaceRoot('/some/path')
      expect(workspacePath).toEqual(undefined)
    })
    it('should return current folder if salto.config exists in it', async () => {
      mockExists.mockResolvedValue(true)
      const workspacePath = await locateWorkspaceRoot('/some/path')
      expect(workspacePath).toEqual('/some/path')
    })
    it('should find the corret folder in which salto.config exists in path', async () => {
      mockExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      const workspacePath = await locateWorkspaceRoot('/some/path')
      expect(workspacePath).toEqual('/some')
    })
  })

  describe('load elements  sources', () => {
    it('should build the appropriate nacl source', async () => {
      mockExists.mockResolvedValue(true)
      const creator: ws.remoteMap.RemoteMapCreator = async <T, K extends string = string>() =>
        new ws.remoteMap.InMemoryRemoteMap<T, K>()
      const elemSources = await loadLocalElementsSources({
        baseDir: '.',
        envs: ['env1', 'env2'],
        remoteMapCreator: creator,
        stateStaticFilesSource: mockStaticFilesSource(),
        workspaceConfig: { name: 'asd', uid: 'asd' },
      })
      expect(Object.keys(elemSources.sources)).toHaveLength(3)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0]).map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env1'))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
    })
  })

  describe('initLocalWorkspace', () => {
    const mockInit = ws.initWorkspace as jest.Mock

    it('should throw error if already inside a workspace', async () => {
      mockExists.mockImplementation(filename => filename === '/fake/salto.config')
      await expect(initLocalWorkspace('/fake/tmp/')).rejects.toThrow(ExistingWorkspaceError)
    })

    it('should throw error if local storage exists', async () => {
      mockExists.mockImplementation((filename: string) => filename.startsWith(getSaltoHome()))
      await expect(initLocalWorkspace('/fake/tmp/')).rejects.toThrow(NotAnEmptyWorkspaceError)
    })

    it('should call initWorkspace with correct input', async () => {
      const envName = 'env-name'
      const wsName = 'ws-name'
      mockExists.mockResolvedValue(false)
      await initLocalWorkspace('.', wsName, envName)
      expect(mockInit.mock.calls[0][0]).toBe(wsName)
      expect(mockInit.mock.calls[0][2]).toBe(envName)
      const envSources: ws.EnvironmentsSources = mockInit.mock.calls[0][6]
      expect(Object.keys(envSources.sources)).toHaveLength(2)
      expect(envSources.commonSourceName).toBe(COMMON_ENV_PREFIX)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0]).map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, envName))
      const uuid = mockInit.mock.calls[0][1]
      expect(dirStoresBaseDirs).toContain(uuid)
      expect(dirStoresBaseDirs).toContain(path.join(uuid, CREDENTIALS_CONFIG_PATH))
    })

    it('should set name according to path if name not given', async () => {
      mockExists.mockResolvedValue(false)
      await initLocalWorkspace('.')
      expect(mockInit.mock.calls[0][0]).toBe(path.basename(path.resolve('.')))
    })
  })

  describe('loadLocalWorkspace', () => {
    const mockLoad = ws.loadWorkspace as jest.Mock
    it('should throw error if not a workspace', async () => {
      mockExists.mockImplementation((filename: string) => !filename.endsWith('salto.config'))
      await expect(loadLocalWorkspace({ path: '.' })).rejects.toThrow(NotAWorkspaceError)
    })

    describe('with valid workspace configuration', () => {
      beforeEach(() => {
        mockExists.mockResolvedValue(true)
        const getConf = repoDirStore.get as jest.Mock
        getConf.mockResolvedValue({
          filename: '',
          buffer: `
            salto {
              uid = "98bb902f-a144-42da-9672-f36e312e8e09"
              name = "test"
              envs = [
                  {
                    name = "default"
                  },
                  {
                    name = "env2"
                  },
              ]
              currentEnv = "default"
            }`,
        })
      })
      it('should call loadWorkspace with correct input', async () => {
        await loadLocalWorkspace({ path: '.' })

        expect(mockLoad).toHaveBeenCalledTimes(1)
        const envSources: ws.EnvironmentsSources = mockLoad.mock.calls[0][3]
        expect(Object.keys(envSources.sources)).toHaveLength(3)
        expect(mockCreateDirStore).toHaveBeenCalledTimes(13)
        const dirStoresBaseDirs = mockCreateDirStore.mock.calls
          .map(c => c[0])
          .map(params => toWorkspaceRelative(params))
        expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
        expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'default'))
      })
      describe('with custom credentials source', () => {
        let credentialSource: jest.Mocked<cs.ConfigSource>
        beforeEach(async () => {
          credentialSource = mockConfigSource()
          await loadLocalWorkspace({
            path: '.',
            credentialSource,
          })
        })
        it('should use the credentials source that was passed as a paramter', async () => {
          expect(mockLoad).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            credentialSource,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            undefined,
            expect.anything(),
          )
        })
      })
      describe('when called with deprecated arguments format', () => {
        beforeEach(async () => {
          await loadLocalWorkspace('my_path', [], false)
        })
        it('should pass the arguments correctly', () => {
          expect(mockExists).toHaveBeenCalledWith(expect.stringMatching(/.*\/my_path\/salto\.config/))
          expect(mockLoad).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            false,
            undefined,
            expect.anything(),
          )
        })
      })
    })
  })

  describe('wrapped renameEnvironment', () => {
    const mockRenameEnvironment = jest.fn()

    beforeAll(() => {
      mockExists.mockResolvedValue(true)
      const mockLoad = ws.loadWorkspace as jest.Mock
      mockLoad.mockResolvedValue({
        renameEnvironment: mockRenameEnvironment,
      })
      const getConf = repoDirStore.get as jest.Mock
      getConf.mockResolvedValue({
        buffer: `
      salto {
        uid = "98bb902f-a144-42da-9672-f36e312e8e09"
        name = "test"
        envs = [
            {
              name = "default"
            }
        ]
        currentEnv = "default"
      }
      `,
        filename: '',
      })
    })

    it('should invoke the rename command on the dir stores after adding the local prefix to the env name', async () => {
      const workspace = await loadLocalWorkspace({ path: '.' })
      await workspace.renameEnvironment('default', 'newEnvName')
      expect(mockRenameEnvironment).toHaveBeenCalledWith('default', 'newEnvName', 'envs/newEnvName')
    })
  })

  describe('demoteAll', () => {
    let wsElemSrcs: EnvironmentsSources
    beforeAll(() => {
      mockExists.mockResolvedValue(true)
      const mockLoad = ws.loadWorkspace as jest.Mock
      mockLoad.mockImplementation(async (_config, _adaptersConfig, _credentials, elemSource: EnvironmentsSources) => {
        wsElemSrcs = elemSource
        return {
          demoteAll: jest.fn(),
          currentEnv: () => 'default',
        }
      })
    })

    describe('without current env', () => {
      beforeAll(() => {
        const getConf = repoDirStore.get as jest.Mock
        getConf.mockResolvedValue({
          buffer: `
        salto {
          uid = "98bb902f-a144-42da-9672-f36e312e8e09"
          name = "test"
          envs = [
              {
                name = "default"
              }
          ]
        }
        `,
          filename: '',
        })
      })

      it('should successfully demote all without crashing', async () => {
        const workspace = await loadLocalWorkspace({ path: '/west' })
        await awu(Object.values(wsElemSrcs.sources)).forEach(src => src.naclFiles.load({}))
        await workspace.demoteAll()
      })
    })

    describe('with only one env', () => {
      beforeAll(() => {
        const getConf = repoDirStore.get as jest.Mock
        getConf.mockResolvedValue({
          buffer: `
        salto {
          uid = "98bb902f-a144-42da-9672-f36e312e8e09"
          name = "test"
          envs = [
              {
                name = "default"
              }
          ]
          currentEnv = "default"
        }
        `,
          filename: '',
        })
      })

      it('should invoke the common source rename method if the env specific folder is empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(true)
        const workspace = await loadLocalWorkspace({ path: '.' })
        await awu(Object.values(wsElemSrcs.sources)).forEach(src => src.naclFiles.load({}))
        await workspace.demoteAll()
        expect(repoDirStore.rename).toHaveBeenCalled()
      })

      it('should invoke the multienvSource demoteAll method if env sepcfic folder is not empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(false)
        const workspace = await loadLocalWorkspace({ path: '/west' })
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })
    })

    describe('with multiple envs', () => {
      beforeAll(() => {
        const getConf = repoDirStore.get as jest.Mock
        getConf.mockResolvedValue({
          buffer: `
        salto {
          uid = "98bb902f-a144-42da-9672-f36e312e8e09"
          name = "test"
          envs = [
              {
                name = "default"
              },
              {
                name = "other"
              }
          ]
          currentEnv = "default"
        }
        `,
          filename: '',
        })
      })

      it('should invoke the common source rename method  if the env specific folder is empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(true)
        const workspace = await loadLocalWorkspace({ path: '.' })
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })

      it('should invoke the common source rename  method if env sepcfic folder is not empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(false)
        const workspace = await loadLocalWorkspace({ path: '/west' })
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })
    })
  })

  describe('load workspsace with existing services, including different account name', () => {
    beforeAll(() => {
      const getConf = repoDirStore.get as jest.Mock
      getConf.mockResolvedValue({
        buffer: `
      salto {
        uid = "98bb902f-a144-42da-9672-f36e312e8e09"
        name = "test"
        envs = [
            {
              name = "default"
              accountToServiceName = {
                salto2 = "salesforce"
                salto1 = "salesforce"
              }
            },
        ]
        currentEnv = "default"
      }
      `,
        filename: '',
      })
    })

    it('should call loadLocalWorkspace with correct input for different account names', async () => {
      const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
      repoIsEmpty.mockResolvedValueOnce(false)
      const envIsEmpty = envDirStore.isEmpty as jest.Mock
      envIsEmpty.mockResolvedValueOnce(false)
      const mockLoad = ws.loadWorkspace as jest.Mock
      await loadLocalWorkspace({ path: '.' })
      expect(mockLoad).toHaveBeenCalledTimes(1)
      const envSources: ws.EnvironmentsSources = mockLoad.mock.calls[0][3]
      expect(Object.keys(envSources.sources)).toHaveLength(2)
      expect(mockCreateDirStore).toHaveBeenCalledTimes(10)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0]).map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'default'))
    })
  })

  describe('clear', () => {
    let lastWorkspace: Value
    beforeEach(() => {
      jest.spyOn(ws, 'loadWorkspace').mockImplementation(() => {
        lastWorkspace = {
          clear: jest.fn(),
        }
        return Promise.resolve(lastWorkspace)
      })
    })
    it('calls workspace clear with the specified parameters and removes the empty envs folder', async () => {
      const workspace = await loadLocalWorkspace({ path: '/west' })
      const args = {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
      }
      await workspace.clear(args)
      expect(lastWorkspace.clear).toHaveBeenCalledTimes(1)
      expect(lastWorkspace.clear).toHaveBeenCalledWith(args)
      expect(file.isEmptyDir.notFoundAsUndefined).toHaveBeenCalledTimes(1)
      expect(file.rm).toHaveBeenCalledTimes(1)
      expect(file.rm).toHaveBeenCalledWith('/west/envs')
    })

    it('does not remove the envs folder if not empty', async () => {
      jest.spyOn(file.isEmptyDir, 'notFoundAsUndefined').mockReturnValueOnce(Promise.resolve(false))
      const workspace = await loadLocalWorkspace({ path: '/west' })
      const args = {
        nacl: true,
        state: true,
        cache: true,
        staticResources: false,
        credentials: true,
      }
      await workspace.clear(args)
      expect(lastWorkspace.clear).toHaveBeenCalledTimes(1)
      expect(lastWorkspace.clear).toHaveBeenCalledWith(args)
      expect(file.isEmptyDir.notFoundAsUndefined).toHaveBeenCalledTimes(1)
      expect(file.rm).not.toHaveBeenCalled()
    })
  })

  describe('getCustomReferences', () => {
    let instance: InstanceElement
    const adaptersConfigSource = mockAdaptersConfigSource()

    beforeEach(() => {
      const type = new ObjectType({
        elemID: new ElemID('test2', 'type'),
      })
      instance = new InstanceElement('instance', type, {
        field: 'val',
      })

      const mockTestAdapter = {
        getCustomReferences: mockFunction<GetCustomReferencesFunc>().mockResolvedValue([
          {
            source: new ElemID('test2', 'type', 'instance', 'inst1'),
            target: new ElemID('test2', 'type', 'instance', 'inst2'),
            type: 'strong',
          },
        ]),
      }

      const mockTest2Adapter = {
        getCustomReferences: mockFunction<GetCustomReferencesFunc>().mockResolvedValue([
          {
            source: new ElemID('test2', 'type', 'instance', 'inst3'),
            target: new ElemID('test2', 'type', 'instance', 'inst4'),
            type: 'strong',
          },
        ]),
      }

      adapterCreators.test = mockTestAdapter as unknown as Adapter
      adapterCreators.test2 = mockTest2Adapter as unknown as Adapter
    })
    it('Should call the right adapter getCustomReferences', async () => {
      const AdapterConfigType = new ObjectType({
        elemID: new ElemID('adapter'),
        isSettings: true,
      })
      const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)
      await adaptersConfigSource.setAdapter('test2', 'test', adapterConfig)
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(references).toEqual([
        {
          source: new ElemID('test2', 'type', 'instance', 'inst1'),
          target: new ElemID('test2', 'type', 'instance', 'inst2'),
          type: 'strong',
        },
      ])
    })

    it('Should use the adapter name when it is not present in the account to service name mapping', async () => {
      const references = await getCustomReferences([instance], {}, adaptersConfigSource)
      expect(references).toEqual([
        {
          source: new ElemID('test2', 'type', 'instance', 'inst3'),
          target: new ElemID('test2', 'type', 'instance', 'inst4'),
          type: 'strong',
        },
      ])
    })

    it('Should return empty array if adapter does not have getCustomReferences func', async () => {
      adapterCreators.test = {} as unknown as Adapter
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(references).toEqual([])
    })

    it('Should not access the adapter config if adapter does not have getCustomReferences func', async () => {
      adapterCreators.test = {} as unknown as Adapter
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(adaptersConfigSource.getAdapter).not.toHaveBeenCalled()
      expect(references).toEqual([])
    })

    it('Should return empty array if adapter getCustomReferences throws an error', async () => {
      adapterCreators.test = {
        getCustomReferences: mockFunction<GetCustomReferencesFunc>().mockRejectedValue(new Error('aaa')),
      } as unknown as Adapter
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(references).toEqual([])
    })
  })
})
