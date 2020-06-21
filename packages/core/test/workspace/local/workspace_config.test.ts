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
import { InstanceElement } from '@salto-io/adapter-api'
import {
  WORKSPACE_CONFIG_NAME, USER_CONFIG_NAME, workspaceConfigType,
  workspaceUserConfigType, DirectoryStore,
} from '@salto-io/workspace'
import { getSaltoHome } from '../../../src/app_config'
import {
  workspaceConfigSource, WorkspaceConfigSource,
} from '../../../src/local-workspace/workspace_config'
import * as mockDirStore from '../../../src/local-workspace/dir_store'

jest.mock('../../../src/local-workspace/dir_store')
describe('workspace local config', () => {
  const mockDirStoreInstance = (key: string, buffer: string): DirectoryStore => ({
    get: jest.fn().mockImplementation(name => (name.startsWith(key) ? ({ buffer, filename: '' }) : undefined)),
    set: jest.fn(),
    flush: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    renameFile: jest.fn(),
    mtimestamp: jest.fn(),
    getFiles: jest.fn(),
    clone: jest.fn(),
  } as unknown as DirectoryStore)
  const repoDirStore = mockDirStoreInstance(WORKSPACE_CONFIG_NAME, `
  workspace {
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
  }
  `)
  const prefDirStore = mockDirStoreInstance(USER_CONFIG_NAME, `
  workspaceUser {
    currentEnv = "default"
  }
  `)
  let configSource: WorkspaceConfigSource
  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
    mockCreateDirStore.mockImplementation((baseDir: string) =>
      (baseDir.startsWith(getSaltoHome()) ? prefDirStore : repoDirStore))
    configSource = await workspaceConfigSource('bla')
  })


  it('localStorage', async () => {
    expect(configSource.localStorage).toBe(
      path.resolve(path.join(getSaltoHome(), 'test-98bb902f-a144-42da-9672-f36e312e8e09'))
    )
  })

  it('envs', async () => {
    expect(configSource.envs).toEqual(['default', 'env2'])
  })

  it('get from both dir stores', async () => {
    expect(configSource.get(WORKSPACE_CONFIG_NAME)).toBeDefined()
    expect(configSource.get(USER_CONFIG_NAME)).toBeDefined()
  })

  it('set in repo dir store', async () => {
    await configSource.set(WORKSPACE_CONFIG_NAME,
      new InstanceElement(WORKSPACE_CONFIG_NAME, workspaceConfigType, {}))
    expect((repoDirStore.set as jest.Mock).mock.calls).toHaveLength(1)
    expect((prefDirStore.set as jest.Mock).mock.calls).toHaveLength(0)
  })

  it('set in pref dir store', async () => {
    await configSource.set(USER_CONFIG_NAME,
      new InstanceElement(USER_CONFIG_NAME, workspaceUserConfigType, {}))
    expect((repoDirStore.set as jest.Mock).mock.calls).toHaveLength(0)
    expect((prefDirStore.set as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('should delete env', async () => {
    await configSource.delete('env')
    expect(prefDirStore.delete as jest.Mock).toHaveBeenCalledTimes(1)
    expect(prefDirStore.delete as jest.Mock).toHaveBeenCalledWith('env')
  })

  it('should rename env', async () => {
    await configSource.rename('old', 'new')
    expect(prefDirStore.renameFile as jest.Mock).toHaveBeenCalledTimes(1)
    expect(prefDirStore.renameFile as jest.Mock).toHaveBeenCalledWith('old', 'new')
  })
})
