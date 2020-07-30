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
import { Values, InstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import { dirStore } from '@salto-io/workspace'
import { getSaltoHome } from '../../../src/app_config'
import {
  workspaceConfigSource, WorkspaceConfigSource,
} from '../../../src/local-workspace/workspace_config'
import * as mockDirStore from '../../../src/local-workspace/dir_store'
import { WORKSPACE_CONFIG_NAME, ENVS_CONFIG_NAME, USER_CONFIG_NAME } from '../../../src/local-workspace/workspace_config_types'
import { NoEnvsConfig, NoWorkspaceConfig } from '../../../src/local-workspace/errors'

jest.mock('../../../src/local-workspace/dir_store')
describe('workspace local config', () => {
  const SALESFORCE = 'adapters/salesforce'
  const mockDirStoreInstance = (obj: Values): dirStore.DirectoryStore<string> => ({
    get: jest.fn().mockImplementation(
      (name: string) => {
        if (!Object.keys(obj).includes(name)) return undefined
        return ({
          buffer: obj[Object.keys(obj).filter(key => name.startsWith(key))[0]],
          filename: '',
        })
      }
    ),
    set: jest.fn(),
    flush: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
    renameFile: jest.fn(),
    mtimestamp: jest.fn(),
    getFiles: jest.fn(),
    clone: jest.fn(),
  } as unknown as dirStore.DirectoryStore<string>)
  const repoDirStore = mockDirStoreInstance({
    [`${WORKSPACE_CONFIG_NAME}.nacl`]: `
    workspace {
    uid = "98bb902f-a144-42da-9672-f36e312e8e09"
    name = "test"
  }
  `,
    [`${ENVS_CONFIG_NAME}.nacl`]: `
  envs {
    envs = [
      {
        name = "default"
      },
      {
        name = "env2"
      },
    ]
  }`,
    [`${SALESFORCE}.nacl`]: `salesforce {
    metadataTypesSkippedList = [
        "Report",
        "ReportType",
        "ReportFolder",
        "Dashboard",
        "DashboardFolder",
    ]
    instancesRegexSkippedList = [
        "^ConnectedApp.CPQIntegrationUserApp$",
        "^EmailTemplate.MarketoEmailTemplates",
    ]
    maxConcurrentRetrieveRequests = 3
    maxItemsInRetrieveRequest = 2500
  }
  `,
  })
  const prefDirStore = mockDirStoreInstance({
    [`${USER_CONFIG_NAME}.nacl`]: `
  workspaceUser {
    currentEnv = "default"
  }
  `,
  })
  let configSource: WorkspaceConfigSource
  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
    mockCreateDirStore.mockImplementation(params =>
      (params.baseDir.startsWith(getSaltoHome()) ? prefDirStore : repoDirStore))
    configSource = await workspaceConfigSource('bla')
  })


  it('localStorage', async () => {
    expect(configSource.localStorage).toBe(
      path.resolve(path.join(getSaltoHome(), 'test-98bb902f-a144-42da-9672-f36e312e8e09'))
    )
  })

  it('get from both dir stores', async () => {
    expect(await configSource.getWorkspaceConfig()).toBeDefined()
    expect((repoDirStore.get as jest.Mock).mock.calls[1][0]).toEqual(`${ENVS_CONFIG_NAME}.nacl`)
    expect((repoDirStore.get as jest.Mock).mock.calls[0][0]).toEqual(`${WORKSPACE_CONFIG_NAME}.nacl`)
    expect((prefDirStore.get as jest.Mock).mock.calls[0][0]).toEqual(`${USER_CONFIG_NAME}.nacl`)
  })

  it('set in repo dir store', async () => {
    await configSource.setWorkspaceConfig({ uid: '1', name: 'foo', currentEnv: 'bar', envs: [], staleStateThresholdMinutes: 60 })
    expect((repoDirStore.set as jest.Mock).mock.calls[0][0].filename).toEqual(`${ENVS_CONFIG_NAME}.nacl`)
    expect((repoDirStore.set as jest.Mock).mock.calls[1][0].filename).toEqual(`${WORKSPACE_CONFIG_NAME}.nacl`)
    expect((prefDirStore.set as jest.Mock).mock.calls[0][0].filename).toEqual(`${USER_CONFIG_NAME}.nacl`)
  })
  it('should look for adapter in repo', async () => {
    (repoDirStore.get as jest.Mock).mockClear()
    await configSource.getAdapter('salesforce')
    expect((repoDirStore.get as jest.Mock).mock.calls).toHaveLength(1)
    expect((prefDirStore.get as jest.Mock).mock.calls).toHaveLength(0)
  })
  it('should set adapter in repo', async () => {
    await configSource.setAdapter('salesforce', new InstanceElement(
      'adapter/salesforce',
      new ObjectType({
        elemID: new ElemID('salesforce'),
      })
    ))
    expect((repoDirStore.set as jest.Mock).mock.calls).toHaveLength(1)
    expect((prefDirStore.set as jest.Mock).mock.calls).toHaveLength(0)
  })
  describe('edge cases', () => {
    const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
    beforeEach(async () => {
      jest.clearAllMocks()
    })
    it('should throw error cannot find local storage', async () => {
      const emptyDirStore = mockDirStoreInstance({})
      mockCreateDirStore.mockImplementation(() => emptyDirStore)
      await expect(workspaceConfigSource('bla')).rejects.toThrow(new Error('Cannot locate local storage directory'))
    })
    it('should throw noEnvsConfig', async () => {
      const noEnvsDirStore = mockDirStoreInstance({
        [`${WORKSPACE_CONFIG_NAME}.nacl`]: 'workspace {}',
      })
      mockCreateDirStore.mockImplementation(() => noEnvsDirStore)
      const conf = await workspaceConfigSource('bla')
      await expect(conf.getWorkspaceConfig()).rejects.toThrow(new NoEnvsConfig())
    })
    it('should throw no workspace Error', async () => {
      let times = 0
      const secondWorkspaceError = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === `${WORKSPACE_CONFIG_NAME}.nacl` && times === 0) {
            times += 1
            return {
              filename: 'workspace.nacl',
              buffer: 'workspace {}',
            }
          }
          return undefined
        }),
      } as unknown as dirStore.DirectoryStore<string>
      mockCreateDirStore.mockImplementation(() => secondWorkspaceError)
      const conf = await workspaceConfigSource('bla')
      await expect(conf.getWorkspaceConfig()).rejects.toThrow(new NoWorkspaceConfig())
    })
  })
})
