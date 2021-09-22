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
import { InstanceElement, ObjectType, ElemID, DetailedChange, getChangeElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { adaptersConfigSource as acs, nacl, remoteMap } from '@salto-io/workspace'
import { adaptersConfigSource } from '../../../src/local-workspace/adapters_config'
import { createMockNaclFileSource } from '../../common/nacl_file_source'

jest.mock('@salto-io/workspace', () => {
  const actual = jest.requireActual('@salto-io/workspace')
  return {
    ...actual,
    staticFiles: {
      ...actual.staticFiles,
      buildStaticFilesSource: jest.fn(),
    },
    nacl: {
      ...actual.nacl,
      naclFilesSource: jest.fn(),
    },
  }
})
jest.mock('../../../src/local-workspace/dir_store')
describe('adapters local config', () => {
  const SALESFORCE = 'adapters/salesforce'

  let mockNaclFilesSource: MockInterface<nacl.NaclFilesSource>
  let configSource: acs.AdaptersConfigSource
  beforeEach(async () => {
    mockNaclFilesSource = createMockNaclFileSource();
    (nacl.naclFilesSource as jest.Mock).mockResolvedValue(mockNaclFilesSource)

    mockNaclFilesSource.get.mockResolvedValue(new InstanceElement(
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
    mockNaclFilesSource.getElementNaclFiles.mockResolvedValue([])
    mockNaclFilesSource.getErrors.mockResolvedValue({
      hasErrors: () => false,
      all: () => [],
      strings: () => [],
      parse: [],
      merge: [],
      validation: [],
    })

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
    expect(mockNaclFilesSource.get).toHaveBeenCalled()
  })

  it('should return undefined when there is not configuration', async () => {
    mockNaclFilesSource.get.mockResolvedValue(undefined)
    expect(await configSource.getAdapter('salesforce')).toBeUndefined()
  })
  it('should set adapter in nacl files source with the default path', async () => {
    await configSource.setAdapter('salesforce', new InstanceElement(
      ElemID.CONFIG_NAME,
      new ObjectType({
        elemID: new ElemID('salesforce', ElemID.CONFIG_NAME),
      })
    ))
    expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledWith([expect.objectContaining({ path: ['salesforce'] })])
    expect(mockNaclFilesSource.flush).toHaveBeenCalled()
  })

  it('should set adapter in nacl files source with the config path', async () => {
    await configSource.setAdapter('salesforce', new InstanceElement(
      ElemID.CONFIG_NAME,
      new ObjectType({
        elemID: new ElemID('salesforce', ElemID.CONFIG_NAME),
      }),
      {},
      ['dir', 'file']
    ))
    expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledWith([expect.objectContaining({ path: ['dir', 'file'] })])
    expect(mockNaclFilesSource.flush).toHaveBeenCalled()
  })

  it('should remove undefined values when setting the configuration', async () => {
    await configSource.setAdapter('salesforce', new InstanceElement(
      ElemID.CONFIG_NAME,
      new ObjectType({
        elemID: new ElemID('salesforce', ElemID.CONFIG_NAME),
      }),
      { value: { inner1: undefined, inner2: 2 } }
    ))
    const receivedChange = mockNaclFilesSource.updateNaclFiles.mock.calls[1][0][0]
    expect(getChangeElement(receivedChange).value).toEqual({ value: { inner2: 2 } })
    expect(mockNaclFilesSource.flush).toHaveBeenCalled()
  })

  it('getElementNaclFiles should return the configuration files', async () => {
    mockNaclFilesSource.getElementNaclFiles.mockResolvedValue(['a/b', 'c'])
    const paths = await configSource.getElementNaclFiles('salesforce')
    expect(paths).toEqual(['salto.config/adapters/a/b', 'salto.config/adapters/c'])
  })

  it('should throw an error when there were errors loading the configuration', async () => {
    mockNaclFilesSource.getErrors.mockResolvedValue({
      hasErrors: () => true,
      strings: () => ['someError'],
      all: () => [],
      parse: [],
      merge: [],
      validation: [],
    })
    await expect(adaptersConfigSource('bla', 'somePath', undefined as unknown as remoteMap.RemoteMapCreator, true, [])).rejects.toThrow()
  })

  describe('configOverrides', () => {
    it('should apply config overrides', async () => {
      expect((await configSource.getAdapter(SALESFORCE))?.value.overridden).toBe(2)
    })

    it('update to an overridden field should throw an exception', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      conf.value.overridden = 3
      await expect(configSource.setAdapter(SALESFORCE, conf)).rejects.toThrow()
      expect(mockNaclFilesSource.updateNaclFiles).not.toHaveBeenCalled()
      expect(mockNaclFilesSource.flush).not.toHaveBeenCalled()
    })

    it('update a none overridden field should not throw an exception', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      conf.value.other = 3
      await configSource.setAdapter(SALESFORCE, conf)
      expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalled()
      expect(mockNaclFilesSource.flush).toHaveBeenCalled()
    })

    it('should call updateNaclFiles twice when there is no configuration', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      mockNaclFilesSource.get.mockResolvedValue(undefined)
      await configSource.setAdapter(SALESFORCE, conf)
      expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledTimes(2)
      expect(mockNaclFilesSource.flush).toHaveBeenCalled()
    })
  })
})
