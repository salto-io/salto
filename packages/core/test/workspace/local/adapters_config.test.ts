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
import { Values, InstanceElement, ObjectType, ElemID, DetailedChange } from '@salto-io/adapter-api'
import { adaptersConfigSource as acs, dirStore, nacl, remoteMap } from '@salto-io/workspace'
import { getSaltoHome } from '../../../src/app_config'
import * as mockDirStore from '../../../src/local-workspace/dir_store'
import { WORKSPACE_CONFIG_NAME, ENVS_CONFIG_NAME, USER_CONFIG_NAME } from '../../../src/local-workspace/workspace_config_types'
import { adaptersConfigSource } from '../../../src/local-workspace/adapters_config'

jest.mock('@salto-io/workspace', () => {
  const actual = jest.requireActual('@salto-io/workspace')
  return {
    ...actual,
    nacl: {
      ...actual.nacl,
      naclFilesSource: jest.fn(),
    },
  }
})
jest.mock('../../../src/local-workspace/dir_store')
describe('adapters local config', () => {
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

  const loadMock = jest.fn()
  const getMock = jest.fn()
  const removeNaclFilesMock = jest.fn()
  const updateNaclFilesMock = jest.fn()
  const flushMock = jest.fn()
  const getElementNaclFilesMock = jest.fn();
  (nacl.naclFilesSource as jest.Mock).mockResolvedValue({
    load: loadMock,
    get: getMock,
    removeNaclFiles: removeNaclFilesMock,
    updateNaclFiles: updateNaclFilesMock,
    flush: flushMock,
    getElementNaclFiles: getElementNaclFilesMock,
  } as unknown as nacl.NaclFilesSource)

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
  })
  const prefDirStore = mockDirStoreInstance({
    [`${USER_CONFIG_NAME}.nacl`]: `
  workspaceUser {
    currentEnv = "default"
  }
  `,
  })
  let configSource: acs.AdaptersConfigSource
  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCreateDirStore = mockDirStore.localDirectoryStore as jest.Mock
    getMock.mockResolvedValue(new InstanceElement(
      ElemID.CONFIG_NAME,
      new ObjectType({ elemID: new ElemID(SALESFORCE, ElemID.CONFIG_NAME) }),
      {
        metadataTypesSkippedList: [
          'Report',
          'ReportType',
          'ReportFolder',
          'Dashboard',
          'DashboardFolder',
          'EmailTemplate',
        ],
        instancesRegexSkippedList: [
          '^ConnectedApp.CPQIntegrationUserApp$',
        ],
        maxItemsInRetrieveRequest: 2500,
        client: {
          maxConcurrentApiRequests: {
            retrieve: 3,
          },
        },
      }
    ))
    getElementNaclFilesMock.mockResolvedValue([])
    mockCreateDirStore.mockImplementation(params =>
      (params.baseDir.startsWith(getSaltoHome()) ? prefDirStore : repoDirStore))

    const configOverrides: DetailedChange[] = [
      {
        id: new ElemID(SALESFORCE, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, 'overridden'),
        action: 'add',
        data: { after: 2 },
      },
    ]
    configSource = await adaptersConfigSource('bla', 'somePath', undefined as unknown as remoteMap.RemoteMapCreator, true, configOverrides)
  })


  it('should look for adapter in nacl files source', async () => {
    await configSource.getAdapter('salesforce')
    expect(getMock).toHaveBeenCalled()
  })

  it('should return undefined when there is not configuration', async () => {
    getMock.mockReturnValue(undefined)
    expect(await configSource.getAdapter('salesforce')).toBeUndefined()
  })
  it('should set adapter in nacl files source with the default path', async () => {
    await configSource.setAdapter('salesforce', new InstanceElement(
      'adapter/salesforce',
      new ObjectType({
        elemID: new ElemID('salesforce'),
      })
    ))
    expect(updateNaclFilesMock).toHaveBeenCalledWith([expect.objectContaining({ path: ['salesforce'] })])
    expect(flushMock).toHaveBeenCalled()
  })

  it('should set adapter in nacl files source with the config path', async () => {
    await configSource.setAdapter('salesforce', new InstanceElement(
      'adapter/salesforce',
      new ObjectType({
        elemID: new ElemID('salesforce'),
      }),
      {},
      ['dir', 'file']
    ))
    expect(updateNaclFilesMock).toHaveBeenCalledWith([expect.objectContaining({ path: ['dir', 'file'] })])
    expect(flushMock).toHaveBeenCalled()
  })

  describe('configOverrides', () => {
    it('should apply config overrides', async () => {
      expect((await configSource.getAdapter(SALESFORCE))?.value.overridden).toBe(2)
    })

    it('update to an overridden field should throw an exception', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      conf.value.overridden = 3
      await expect(configSource.setAdapter(SALESFORCE, conf)).rejects.toThrow()
      expect(updateNaclFilesMock).not.toHaveBeenCalled()
      expect(flushMock).not.toHaveBeenCalled()
    })

    it('update a none overridden field should not throw an exception', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      conf.value.other = 3
      await configSource.setAdapter(SALESFORCE, conf)
      expect(updateNaclFilesMock).toHaveBeenCalled()
      expect(flushMock).toHaveBeenCalled()
    })

    it('should call updateNaclFiles only once when there is no configuration', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      getMock.mockResolvedValue(undefined)
      await configSource.setAdapter(SALESFORCE, conf)
      expect(updateNaclFilesMock).toHaveBeenCalledTimes(1)
      expect(flushMock).toHaveBeenCalled()
    })
  })
})
