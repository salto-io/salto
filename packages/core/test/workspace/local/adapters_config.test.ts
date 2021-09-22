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
import { InstanceElement, ObjectType, ElemID, DetailedChange } from '@salto-io/adapter-api'
import { adaptersConfigSource as acs, nacl, remoteMap } from '@salto-io/workspace'
import { mockFunction } from '@salto-io/test-utils'
import { adaptersConfigSource } from '../../../src/local-workspace/adapters_config'

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

  const loadMock = mockFunction<nacl.NaclFilesSource['load']>()
  const getMock = mockFunction<nacl.NaclFilesSource['get']>()
  const removeNaclFilesMock = mockFunction<nacl.NaclFilesSource['removeNaclFiles']>()
  const updateNaclFilesMock = mockFunction<nacl.NaclFilesSource['updateNaclFiles']>()
  const flushMock = mockFunction<nacl.NaclFilesSource['flush']>()
  const getElementNaclFilesMock = mockFunction<nacl.NaclFilesSource['getElementNaclFiles']>()
  const getErrorsMock = mockFunction<nacl.NaclFilesSource['getErrors']>();
  (nacl.naclFilesSource as jest.Mock).mockResolvedValue({
    load: loadMock,
    get: getMock,
    removeNaclFiles: removeNaclFilesMock,
    updateNaclFiles: updateNaclFilesMock,
    flush: flushMock,
    getElementNaclFiles: getElementNaclFilesMock,
    getErrors: getErrorsMock,
  })

  let configSource: acs.AdaptersConfigSource
  beforeEach(async () => {
    jest.clearAllMocks()
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
    getErrorsMock.mockResolvedValue({
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
    expect(getMock).toHaveBeenCalled()
  })

  it('should return undefined when there is not configuration', async () => {
    getMock.mockResolvedValue(undefined)
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

  it('getNaclPaths should return the configuration files', async () => {
    getElementNaclFilesMock.mockResolvedValue(['a/b', 'c'])
    const paths = await configSource.getNaclPaths('salesforce')
    expect(paths).toEqual(['salto.config/adapters/a/b', 'salto.config/adapters/c'])
  })

  it('should throw an error when there were errors loading the configuration', async () => {
    getErrorsMock.mockResolvedValue({
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

    it('should call updateNaclFiles twice when there is no configuration', async () => {
      const conf = await configSource.getAdapter(SALESFORCE) as InstanceElement
      getMock.mockResolvedValue(undefined)
      await configSource.setAdapter(SALESFORCE, conf)
      expect(updateNaclFilesMock).toHaveBeenCalledTimes(2)
      expect(flushMock).toHaveBeenCalled()
    })
  })
})
