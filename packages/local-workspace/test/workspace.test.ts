/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import { Adapter, AdapterOperations, ElemID, ObjectType, Value } from '@salto-io/adapter-api'
import * as ws from '@salto-io/workspace'
import * as file from '@salto-io/file'
import { remoteMap, EnvironmentsSources, configSource as cs, errors } from '@salto-io/workspace'
import { collections, values } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import {
  CREDENTIALS_CONFIG_PATH,
  ExistingWorkspaceError,
  initLocalWorkspace,
  loadLocalElementsSources,
  loadLocalWorkspace,
  locateWorkspaceRoot,
  NotAnEmptyWorkspaceError,
  NotAWorkspaceError,
} from '../src/workspace'
import { getSaltoHome } from '../src/app_config'
import * as mockDirStore from '../src/dir_store'
import { mockStaticFilesSource } from './common/state'
import { WorkspaceConfigSource } from '../src/workspace_config'

const { awu } = collections.asynciterable
const { ENVS_PREFIX } = ws.nacl
const { COMMON_ENV_PREFIX } = ws

const mockRemoteMapCreator = remoteMap.inMemRemoteMapCreator()

const mockConfigSource = (): jest.Mocked<cs.ConfigSource> => ({
  get: mockFunction<cs.ConfigSource['get']>(),
  set: mockFunction<cs.ConfigSource['set']>(),
  delete: mockFunction<cs.ConfigSource['delete']>(),
  rename: mockFunction<cs.ConfigSource['rename']>(),
})

const mockWorkspaceConfigSource = (): jest.Mocked<WorkspaceConfigSource> => ({
  getWorkspaceConfig: mockFunction<WorkspaceConfigSource['getWorkspaceConfig']>().mockResolvedValue({
    uid: 'mock-uid',
    envs: [{ name: 'default' }],
    currentEnv: 'default',
  }),
  setWorkspaceConfig: mockFunction<WorkspaceConfigSource['setWorkspaceConfig']>(),
  localStorage: 'mocked-local-storage',
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
jest.mock('../src/dir_store')
const mockClose = jest.fn()
jest.mock('../src/remote_map', () => ({
  ...jest.requireActual<{}>('../src/remote_map'),
  createRemoteMapCreator: () => ({ create: mockRemoteMapCreator.create, close: mockClose }),
}))
describe('local workspace', () => {
  const sfMockAdapterName = 'salesforce'
  const mockAdapterCreator: Record<string, Adapter> = {}
  const configType = new ObjectType({ elemID: new ElemID(sfMockAdapterName) })
  const credentialsType = new ObjectType({ elemID: new ElemID(sfMockAdapterName) })
  mockAdapterCreator[sfMockAdapterName] = {
    operations: mockFunction<Adapter['operations']>().mockReturnValue({
      fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
      deploy: mockFunction<AdapterOperations['deploy']>().mockResolvedValue({ appliedChanges: [], errors: [] }),
    }),
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({ accountId: 'accountID' }),
    authenticationMethods: {
      basic: { credentialsType },
    },
    configType,
  }

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
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('locateWorkspaceRoot', () => {
    it('should return undefined if no workspaceRoot exists in path', async () => {
      mockExists.mockResolvedValue(false)
      const workspacePath = await locateWorkspaceRoot({ lookupDir: '/some/path' })
      expect(workspacePath).toEqual(undefined)
    })
    it('should return current folder if salto.config exists in it', async () => {
      mockExists.mockResolvedValue(true)
      const workspacePath = await locateWorkspaceRoot({ lookupDir: '/some/path' })
      expect(workspacePath).toEqual('/some/path')
    })
    it('should find the corret folder in which salto.config exists in path', async () => {
      mockExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      const workspacePath = await locateWorkspaceRoot({ lookupDir: '/some/path' })
      expect(workspacePath).toEqual('/some')
    })
    it('should only check the provided path if allowWorkspaceRootLookup is false', async () => {
      mockExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      const workspacePath = await locateWorkspaceRoot({ lookupDir: '/some/path', allowWorkspaceRootLookup: false })
      expect(workspacePath).toEqual(undefined)
    })
    it('should support deprecated string argument', async () => {
      mockExists.mockResolvedValue(true)
      const workspacePath = await locateWorkspaceRoot('/some/path')
      expect(workspacePath).toEqual('/some/path')
    })
  })

  describe('loadLocalElementsSources', () => {
    it('should build the appropriate nacl source', async () => {
      mockExists.mockResolvedValue(true)
      const creator = remoteMap.inMemRemoteMapCreator()
      const elemSources = await loadLocalElementsSources({
        baseDir: '.',
        envs: ['env1', 'env2'],
        remoteMapCreator: creator,
        stateStaticFilesSource: mockStaticFilesSource(),
        workspaceConfig: { uid: 'asd' },
      })
      expect(Object.keys(elemSources.sources)).toHaveLength(3)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0]).map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env1'))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
    })
  })

  describe('initLocalWorkspace', () => {
    const mockInit = ws.initWorkspace as jest.Mock
    const mockAdapterCreators: Record<string, Adapter> = {}

    it('should throw error if already inside a workspace', async () => {
      mockExists.mockImplementation(filename => filename === '/fake/salto.config')
      await expect(
        initLocalWorkspace({
          baseDir: '/fake/tmp/',
          configTypes: [],
          adapterCreators: mockAdapterCreators,
        }),
      ).rejects.toThrow(ExistingWorkspaceError)
    })

    it('should throw error if local storage exists', async () => {
      mockExists.mockImplementation((filename: string) => filename.startsWith(getSaltoHome()))
      await expect(
        initLocalWorkspace({
          baseDir: '/fake/tmp/',
          configTypes: [],
          adapterCreators: mockAdapterCreator,
        }),
      ).rejects.toThrow(NotAnEmptyWorkspaceError)
    })

    it('should throw error for invalid name', async () => {
      mockExists.mockResolvedValue(false)
      await expect(
        initLocalWorkspace({
          baseDir: '/fake/tmp/',
          envName: 'long'.repeat(100),
          configTypes: [],
          adapterCreators: mockAdapterCreator,
        }),
      ).rejects.toThrow(errors.InvalidEnvNameError)
    })
    it('should call initWorkspace with correct input', async () => {
      const envName = 'env-name'
      mockExists.mockResolvedValue(false)
      await initLocalWorkspace({ baseDir: '.', envName, configTypes: [], adapterCreators: mockAdapterCreator })
      expect(mockInit.mock.calls[0][0].defaultEnvName).toBe(envName)
      const envSources: ws.EnvironmentsSources = mockInit.mock.calls[0][0].environmentSources
      expect(Object.keys(envSources.sources)).toHaveLength(2)
      expect(envSources.commonSourceName).toBe(COMMON_ENV_PREFIX)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0]).map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, envName))
      const uuid = mockInit.mock.calls[0][0].uid
      expect(dirStoresBaseDirs).toContain(uuid)
      expect(dirStoresBaseDirs).toContain(path.join(uuid, CREDENTIALS_CONFIG_PATH))
    })
    describe('when initLocalWorkspace throws an error', () => {
      const envName = 'env-name'
      it('should call close', async () => {
        mockExists.mockResolvedValue(false)
        mockInit.mockRejectedValue(new Error('oh no!'))
        await expect(
          initLocalWorkspace({ baseDir: '.', envName, configTypes: [], adapterCreators: mockAdapterCreator }),
        ).rejects.toThrow(new Error('oh no!'))
        expect(mockClose).toHaveBeenCalledTimes(1)
      })
      it('should call close, and throw the original error, if close throws as well', async () => {
        mockExists.mockResolvedValue(false)
        mockInit.mockRejectedValue(new Error('oh no!'))
        mockClose.mockRejectedValue('close error!')
        await expect(
          initLocalWorkspace({ baseDir: '.', envName, configTypes: [], adapterCreators: mockAdapterCreator }),
        ).rejects.toThrow(new Error('oh no!'))
        expect(mockClose).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('loadLocalWorkspace', () => {
    const mockLoad = ws.loadWorkspace as jest.Mock
    beforeEach(() => {
      mockExists.mockImplementation((filename: string) => !filename.endsWith('salto.config'))
    })
    it('should throw error if not a workspace', async () => {
      await expect(
        loadLocalWorkspace({
          path: '/tmp/nested/path',
          adapterCreators: mockAdapterCreator,
        }),
      ).rejects.toThrow(NotAWorkspaceError)
      expect(mockExists).toHaveBeenCalledTimes(3)
      expect(mockExists).toHaveBeenNthCalledWith(1, '/tmp/nested/path/salto.config')
      expect(mockExists).toHaveBeenNthCalledWith(2, '/tmp/nested/salto.config')
      expect(mockExists).toHaveBeenNthCalledWith(3, '/tmp/salto.config')
    })

    describe('with allowWorkspaceRootLookup as false', () => {
      beforeEach(async () => {
        await expect(
          loadLocalWorkspace({
            path: '/tmp/nested/path',
            adapterCreators: mockAdapterCreator,
            allowWorkspaceRootLookup: false,
          }),
        ).rejects.toThrow(NotAWorkspaceError)
      })
      it('should only check the provided path', () => {
        expect(mockExists).toHaveBeenCalledExactlyOnceWith('/tmp/nested/path/salto.config')
      })
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
        await loadLocalWorkspace({
          path: '.',
          adapterCreators: mockAdapterCreator,
        })

        expect(mockLoad).toHaveBeenCalledTimes(1)
        const envSources: ws.EnvironmentsSources = mockLoad.mock.calls[0][0].environmentsSources
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
            adapterCreators: mockAdapterCreator,
          })
        })
        it('should use the credentials source that was passed as a paramter', async () => {
          expect(mockLoad).toHaveBeenCalledWith(
            expect.objectContaining({
              credentials: credentialSource,
            }),
          )
        })
      })
      describe('with custom config source', () => {
        let configSource: jest.Mocked<WorkspaceConfigSource>
        beforeEach(async () => {
          configSource = mockWorkspaceConfigSource()
          await loadLocalWorkspace({
            path: '.',
            workspaceConfigSource: configSource,
            adapterCreators: mockAdapterCreator,
          })
        })
        it('should use the config source that was passed as a paramter', async () => {
          expect(mockLoad).toHaveBeenCalledWith(
            expect.objectContaining({
              config: configSource,
            }),
          )
        })
      })
      describe('when loadLocalWorkspace throws an error', () => {
        it('should call close', async () => {
          mockLoad.mockRejectedValue(new Error('oh no!'))
          await expect(
            loadLocalWorkspace({
              path: '.',
              adapterCreators: mockAdapterCreator,
            }),
          ).rejects.toThrow(new Error('oh no!'))
          expect(mockClose).toHaveBeenCalledTimes(1)
        })
        it('should call close, and throw the original error, if close throws as well', async () => {
          mockLoad.mockRejectedValue(new Error('oh no!'))
          mockClose.mockRejectedValue(new Error('Close Failed!'))
          await expect(
            loadLocalWorkspace({
              path: '.',
              adapterCreators: mockAdapterCreator,
            }),
          ).rejects.toThrow(new Error('oh no!'))
          expect(mockClose).toHaveBeenCalledTimes(1)
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
      const workspace = await loadLocalWorkspace({
        path: '.',
        adapterCreators: mockAdapterCreator,
      })
      await workspace.renameEnvironment('default', 'newEnvName')
      expect(mockRenameEnvironment).toHaveBeenCalledWith('default', 'newEnvName', 'envs/newEnvName')
    })
  })

  describe('demoteAll', () => {
    let wsElemSrcs: EnvironmentsSources
    beforeAll(() => {
      mockExists.mockResolvedValue(true)
      const mockLoad = ws.loadWorkspace as jest.Mock
      mockLoad.mockImplementation(async config => {
        wsElemSrcs = config.environmentsSources
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
        const workspace = await loadLocalWorkspace({
          path: '/west',
          adapterCreators: mockAdapterCreator,
        })
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
        const workspace = await loadLocalWorkspace({
          path: '.',
          adapterCreators: mockAdapterCreator,
        })
        await awu(Object.values(wsElemSrcs.sources)).forEach(src => src.naclFiles.load({}))
        await workspace.demoteAll()
        expect(repoDirStore.rename).toHaveBeenCalled()
      })

      it('should invoke the multienvSource demoteAll method if env sepcfic folder is not empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(false)
        const workspace = await loadLocalWorkspace({
          path: '/west',
          adapterCreators: mockAdapterCreator,
        })
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
        const workspace = await loadLocalWorkspace({
          path: '.',
          adapterCreators: mockAdapterCreator,
        })
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })

      it('should invoke the common source rename  method if env sepcfic folder is not empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(false)
        const workspace = await loadLocalWorkspace({
          path: '/west',
          adapterCreators: mockAdapterCreator,
        })
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
      await loadLocalWorkspace({
        path: '.',
        adapterCreators: mockAdapterCreator,
      })
      expect(mockLoad).toHaveBeenCalledTimes(1)
      const envSources: ws.EnvironmentsSources = mockLoad.mock.calls[0][0].environmentsSources
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
      const workspace = await loadLocalWorkspace({
        path: '/west',
        adapterCreators: mockAdapterCreator,
      })
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
      const workspace = await loadLocalWorkspace({
        path: '/west',
        adapterCreators: mockAdapterCreator,
      })
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
})
