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
import path from 'path'
import { Value } from '@salto-io/adapter-api'
import * as ws from '@salto-io/workspace'
import * as file from '@salto-io/file'
import {
  initLocalWorkspace, ExistingWorkspaceError, NotAnEmptyWorkspaceError, NotAWorkspaceError,
  loadLocalWorkspace, CREDENTIALS_CONFIG_PATH,
  loadLocalElementsSources, locateWorkspaceRoot,
} from '../../../src/local-workspace/workspace'
import { getSaltoHome } from '../../../src/app_config'
import * as mockDirStore from '../../../src/local-workspace/dir_store'

const { ENVS_PREFIX } = ws.nacl
const { COMMON_ENV_PREFIX } = ws

const mockRemoteMapCreator = (async <T, K extends string = string>(
  _opts: ws.remoteMap.CreateRemoteMapParams<T>,
): Promise<ws.remoteMap.RemoteMap<T, K>> =>
  new ws.remoteMap.InMemoryRemoteMap<T, K>())

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
  initWorkspace: jest.fn(),
  loadWorkspace: jest.fn(),
}))
jest.mock('../../../src/local-workspace/dir_store')
jest.mock('../../../src/local-workspace/static_files_cache', () => ({
  buildLocalStaticFilesCache: () => ({
    rename: jest.fn(),
  }),
}))
jest.mock('../../../src/local-workspace/remote_map', () => ({
  ...jest.requireActual<{}>('../../../src/local-workspace/remote_map'),
  createRemoteMapCreator: () => mockRemoteMapCreator,
}))
describe('local workspace', () => {
  const mockExists = file.exists as jest.Mock
  const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
  const mockDirStoreInstance = (): ws.dirStore.DirectoryStore<string> => ({
    get: jest.fn().mockResolvedValue({ buffer: '', filename: '' }),
    set: jest.fn(),
    flush: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    mtimestamp: jest.fn(),
    getFiles: jest.fn(),
    clone: jest.fn(),
    isEmpty: jest.fn().mockResolvedValue(true),
    rename: jest.fn(),
  } as unknown as ws.dirStore.DirectoryStore<string>)
  const repoDirStore = mockDirStoreInstance()
  const localDirStore = mockDirStoreInstance()
  const envDirStore = mockDirStoreInstance()
  mockCreateDirStore.mockImplementation(params => {
    if (params.baseDir.startsWith(getSaltoHome())) {
      return localDirStore
    }
    return params.name.includes(ENVS_PREFIX) ? envDirStore : repoDirStore
  })
  const toWorkspaceRelative = (params: {baseDir: string; name: string}): string => {
    const dir = path.join(params.baseDir, params.name)
    return (dir.startsWith(getSaltoHome())
      ? path.relative(getSaltoHome(), dir)
      : `${path.basename(path.dirname(dir))}${path.sep}${path.basename(dir)}`)
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
      await expect(workspacePath).toEqual('/some/path')
    })
    it('should find the corret folder in which salto.config exists in path', async () => {
      mockExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      const workspacePath = await locateWorkspaceRoot('/some/path')
      await expect(workspacePath).toEqual('/some')
    })
  })

  describe('load elements  sources', () => {
    it('should build the appropriate nacl source', async () => {
      mockExists.mockResolvedValue(true)
      const creator: ws.remoteMap.RemoteMapCreator = async <T, K extends string = string>() =>
        new ws.remoteMap.InMemoryRemoteMap<T, K>()
      const elemSources = await loadLocalElementsSources(
        '.', path.join(getSaltoHome(), 'local'), ['env1', 'env2'], creator
      )
      expect(Object.keys(elemSources.sources)).toHaveLength(3)
      expect(mockCreateDirStore).toHaveBeenCalledTimes(6)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env1'))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
    })
  })

  describe('initLocalWorkspace', () => {
    const mockInit = ws.initWorkspace as jest.Mock

    it('should throw error if already inside a workspace', async () => {
      mockExists.mockImplementation(filename => (filename === '/fake/salto.config'))
      await expect(initLocalWorkspace('/fake/tmp/')).rejects.toThrow(ExistingWorkspaceError)
    })

    it('should throw error if local storage exists', async () => {
      mockExists.mockImplementation((filename: string) => (filename.startsWith(getSaltoHome())))
      await expect(initLocalWorkspace('/fake/tmp/')).rejects.toThrow(NotAnEmptyWorkspaceError)
    })

    it('should call initWorkspace with currect input', async () => {
      const envName = 'env-name'
      const wsName = 'ws-name'
      mockExists.mockResolvedValue(false)
      await initLocalWorkspace('.', wsName, envName)
      expect(mockInit.mock.calls[0][0]).toBe(wsName)
      expect(mockInit.mock.calls[0][2]).toBe(envName)
      const envSources: ws.EnvironmentsSources = mockInit.mock.calls[0][5]
      expect(Object.keys(envSources.sources)).toHaveLength(2)
      expect(envSources.commonSourceName).toBe(COMMON_ENV_PREFIX)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, envName))
      const uuid = mockInit.mock.calls[0][1]
      const localStorage = `${wsName}-${uuid}`
      expect(dirStoresBaseDirs).toContain(localStorage)
      expect(dirStoresBaseDirs).toContain(path.join(localStorage, CREDENTIALS_CONFIG_PATH))
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
      mockExists.mockImplementation((filename: string) => (!filename.endsWith('salto.config')))
      await expect(loadLocalWorkspace('.')).rejects.toThrow(NotAWorkspaceError)
    })

    it('should call loadWorkspace with currect input', async () => {
      mockExists.mockResolvedValue(true)
      const getConf = repoDirStore.get as jest.Mock
      getConf.mockResolvedValue({ buffer: `
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
      }
      `,
      filename: '' })
      await loadLocalWorkspace('.')

      expect(mockLoad).toHaveBeenCalledTimes(1)
      const envSources: ws.EnvironmentsSources = mockLoad.mock.calls[0][2]
      expect(Object.keys(envSources.sources)).toHaveLength(3)
      expect(mockCreateDirStore).toHaveBeenCalledTimes(9)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(params => toWorkspaceRelative(params))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'default'))
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
      getConf.mockResolvedValue({ buffer: `
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
      filename: '' })
    })

    it('should invoke the rename command on the dir stores after adding the local prefix to the env name', async () => {
      const workspace = await loadLocalWorkspace('.')
      await workspace.renameEnvironment('default', 'newEnvName')
      expect(mockRenameEnvironment).toHaveBeenCalledWith('default', 'newEnvName', 'envs/newEnvName')
    })
  })

  describe('demoteAll', () => {
    beforeAll(() => {
      mockExists.mockResolvedValue(true)
      const mockLoad = ws.loadWorkspace as jest.Mock
      mockLoad.mockResolvedValue({
        demoteAll: jest.fn(),
      })
    })

    describe('with only one env', () => {
      beforeAll(() => {
        const getConf = repoDirStore.get as jest.Mock
        getConf.mockResolvedValue({ buffer: `
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
        filename: '' })
      })

      it('should invoke the common source rename method if the env specific folder is empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(true)
        const workspace = await loadLocalWorkspace('.')
        await workspace.demoteAll()
        expect(repoDirStore.rename).toHaveBeenCalled()
      })

      it('should invoke the multienvSource demoteAll method if env sepcfic folder is not empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(false)
        const workspace = await loadLocalWorkspace('/west')
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })
    })

    describe('with multiple envs', () => {
      beforeAll(() => {
        const getConf = repoDirStore.get as jest.Mock
        getConf.mockResolvedValue({ buffer: `
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
        filename: '' })
      })

      it('should invoke the common source rename method  if the env specific folder is empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(true)
        const workspace = await loadLocalWorkspace('.')
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })

      it('should invoke the common source rename  method if env sepcfic folder is not empty', async () => {
        const repoIsEmpty = repoDirStore.isEmpty as jest.Mock
        repoIsEmpty.mockResolvedValueOnce(false)
        const envIsEmpty = envDirStore.isEmpty as jest.Mock
        envIsEmpty.mockResolvedValueOnce(false)
        const workspace = await loadLocalWorkspace('/west')
        await workspace.demoteAll()
        expect(repoDirStore.rename).not.toHaveBeenCalled()
      })
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
      const workspace = await loadLocalWorkspace('/west')
      const args = {
        nacl: true, state: true, cache: true, staticResources: true, credentials: true,
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
      const workspace = await loadLocalWorkspace('/west')
      const args = {
        nacl: true, state: true, cache: true, staticResources: false, credentials: true,
      }
      await workspace.clear(args)
      expect(lastWorkspace.clear).toHaveBeenCalledTimes(1)
      expect(lastWorkspace.clear).toHaveBeenCalledWith(args)
      expect(file.isEmptyDir.notFoundAsUndefined).toHaveBeenCalledTimes(1)
      expect(file.rm).not.toHaveBeenCalled()
    })
  })
})
