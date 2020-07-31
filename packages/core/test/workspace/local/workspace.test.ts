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
import * as ws from '@salto-io/workspace'
import { exists } from '@salto-io/file'
import {
  initLocalWorkspace, ExistingWorkspaceError, NotAnEmptyWorkspaceError, NotAWorkspaceError,
  loadLocalWorkspace, COMMON_ENV_PREFIX, CREDENTIALS_CONFIG_PATH,
  loadLocalElementsSources,
} from '../../../src/local-workspace/workspace'
import { getSaltoHome } from '../../../src/app_config'
import * as mockDirStore from '../../../src/local-workspace/dir_store'

const { ENVS_PREFIX } = ws.nacl

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual('@salto-io/file'),
  exists: jest.fn(),
}))
jest.mock('@salto-io/workspace', () => ({
  ...jest.requireActual('@salto-io/workspace'),
  initWorkspace: jest.fn(),
  loadWorkspace: jest.fn(),
}))
jest.mock('../../../src/local-workspace/dir_store')
describe('local workspace', () => {
  const mockExists = exists as jest.Mock
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
  } as unknown as ws.dirStore.DirectoryStore<string>)
  const repoDirStore = mockDirStoreInstance()
  const localDirStore = mockDirStoreInstance()
  mockCreateDirStore.mockImplementation(params =>
    (params.baseDir.startsWith(getSaltoHome()) ? localDirStore : repoDirStore))
  const toWorkspaceRelative = (dir: string): string =>
    (dir.startsWith(getSaltoHome())
      ? path.relative(getSaltoHome(), dir)
      : `${path.basename(path.dirname(dir))}${path.sep}${path.basename(dir)}`)

  beforeEach(() => jest.clearAllMocks())

  describe('load elements  sources', () => {
    it('should build the appropriate nacl source', () => {
      mockExists.mockResolvedValue(true)
      const elemSources = loadLocalElementsSources('.', path.join(getSaltoHome(), 'local'), ['env1', 'env2'])
      expect(Object.keys(elemSources.sources)).toHaveLength(3)
      expect(mockCreateDirStore).toHaveBeenCalledTimes(9)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(params => toWorkspaceRelative(params.baseDir))
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
        .map(params => toWorkspaceRelative(params.baseDir))
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
      expect(mockCreateDirStore).toHaveBeenCalledTimes(12)
      const dirStoresBaseDirs = mockCreateDirStore.mock.calls.map(c => c[0])
        .map(params => toWorkspaceRelative(params.baseDir))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'env2'))
      expect(dirStoresBaseDirs).toContain(path.join(ENVS_PREFIX, 'default'))
    })
  })
})
