/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { DirectoryStore } from 'src/workspace/dir_store'
import * as mockFiles from '../../../src/file'
import { initLocalWorkspace, ExistingWorkspaceError, NotAnEmptyWorkspaceError, NotAWorkspaceError, loadLocalWorkspace, COMMON_ENV_PREFIX, ENVS_PREFIX, CREDENTIALS_CONFIG_PATH } from '../../../src/workspace/local/workspace'
import { getSaltoHome } from '../../../src/app_config'
import * as mockWs from '../../../src/workspace/workspace'
import * as mockDirStore from '../../../src/workspace/local/dir_store'

jest.mock('../../../src/file')
jest.mock('../../../src/workspace/workspace')
jest.mock('../../../src/workspace/local/dir_store')
describe('local workspace', () => {
  const mockExists = mockFiles.exists as jest.Mock
  const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
  const mockDirStoreInstance = (): DirectoryStore => ({
    get: jest.fn(),
    set: jest.fn(),
    flush: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    mtimestamp: jest.fn(),
    getFiles: jest.fn(),
    clone: jest.fn(),
  } as unknown as DirectoryStore)
  const repoDirStore = mockDirStoreInstance()
  const localDirStore = mockDirStoreInstance()
  mockCreateDirStore.mockImplementation((baseDir: string) =>
    (baseDir.startsWith(getSaltoHome()) ? localDirStore : repoDirStore))
  const toWorkspaceRelative = (dir: string): string =>
    (dir.startsWith(getSaltoHome())
      ? path.relative(getSaltoHome(), dir)
      : `${path.basename(path.dirname(dir))}${path.sep}${path.basename(dir)}`)

  beforeEach(() => jest.clearAllMocks())

  describe('initLocalWorkspace', () => {
    const mockInit = mockWs.initWorkspace as jest.Mock

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
      const envSources: mockWs.EnvironmentsSources = mockInit.mock.calls[0][5]
      expect(Object.keys(envSources.sources)).toHaveLength(2)
      expect(envSources.commonSourceName).toBe(COMMON_ENV_PREFIX)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(toWorkspaceRelative)
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
    const mockLoad = mockWs.loadWorkspace as jest.Mock
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
      ` })
      await loadLocalWorkspace('.')

      expect(mockLoad).toHaveBeenCalledTimes(1)
      const envSources: mockWs.EnvironmentsSources = mockLoad.mock.calls[0][2]
      expect(Object.keys(envSources.sources)).toHaveLength(3)
      expect(mockCreateDirStore).toHaveBeenCalledTimes(12)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(toWorkspaceRelative)
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'default'))
    })
  })
})
