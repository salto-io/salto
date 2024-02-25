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

import {
  ElemID,
  InstanceElement,
  StaticFile,
  ChangeDataType,
  DeployResult,
  getChangeData,
  FetchOptions,
  ObjectType,
  Change,
  isObjectType,
  toChange,
  BuiltinTypes,
  SaltoError,
  SaltoElementError,
  ProgressReporter,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import createClient from './client/sdf_client'
import NetsuiteAdapter from '../src/adapter'
import { getMetadataTypes, metadataTypesToList, SUITEAPP_CONFIG_RECORD_TYPES } from '../src/types'
import {
  ENTITY_CUSTOM_FIELD,
  SCRIPT_ID,
  SAVED_SEARCH,
  FILE,
  FOLDER,
  PATH,
  TRANSACTION_FORM,
  CONFIG_FEATURES,
  INTEGRATION,
  NETSUITE,
  REPORT_DEFINITION,
  FINANCIAL_LAYOUT,
  ROLE,
  METADATA_TYPE,
  CUSTOM_RECORD_TYPE,
} from '../src/constants'
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import { LocalFilterCreator } from '../src/filter'
import SdfClient from '../src/client/sdf_client'
import resolveValuesFilter from '../src/filters/element_references'
import { configType, NetsuiteConfig } from '../src/config/types'
import { getConfigFromConfigChanges } from '../src/config/suggestions'
import { mockGetElemIdFunc } from './utils'
import NetsuiteClient from '../src/client/client'
import {
  CustomizationInfo,
  CustomTypeInfo,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  SDFObjectNode,
} from '../src/client/types'
import * as changesDetector from '../src/changes_detector/changes_detector'
import * as deletionCalculator from '../src/deletion_calculator'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { SERVER_TIME_TYPE_NAME } from '../src/server_time'
import * as suiteAppFileCabinet from '../src/client/suiteapp_client/suiteapp_file_cabinet'
import { SDF_CREATE_OR_UPDATE_GROUP_ID } from '../src/group_changes'
import { SuiteAppFileCabinetOperations } from '../src/client/suiteapp_client/suiteapp_file_cabinet'
import getChangeValidator from '../src/change_validator'
import { getStandardTypesNames } from '../src/autogen/types'
import { createCustomRecordTypes } from '../src/custom_records/custom_record_type'
import { Graph, GraphNode } from '../src/client/graph_utils'
import { getDataElements } from '../src/data_elements/data_elements'
import * as elementsSourceIndexModule from '../src/elements_source_index/elements_source_index'
import { fullQueryParams, fullFetchConfig } from '../src/config/config_creator'
import { FetchByQueryFunc } from '../src/config/query'

const DEFAULT_SDF_DEPLOY_PARAMS = {
  manifestDependencies: {
    optionalFeatures: [],
    requiredFeatures: [],
    excludedFeatures: [],
    includedObjects: [],
    excludedObjects: [],
    includedFiles: [],
    excludedFiles: [],
  },
  validateOnly: false,
}

jest.mock('../src/config/suggestions', () => ({
  ...jest.requireActual<{}>('../src/config/suggestions'),
  getConfigFromConfigChanges: jest.fn(),
}))

jest.mock('../src/data_elements/data_elements', () => ({
  ...jest.requireActual<{}>('../src/data_elements/data_elements'),
  getDataElements: jest.fn(() => ({ elements: [], largeTypesError: [] })),
}))

jest.mock('../src/change_validator')
const getChangeValidatorMock = getChangeValidator as jest.Mock

getChangeValidatorMock.mockImplementation(
  // eslint-disable-next-line no-empty-pattern
  ({}: {
    withSuiteApp: boolean
    warnStaleData: boolean
    fetchByQuery: FetchByQueryFunc
    deployReferencedElements?: boolean
  }) =>
    (_changes: ReadonlyArray<Change>) =>
      Promise.resolve([]),
)

jest.mock('../src/changes_detector/changes_detector')

const onFetchMock = jest.fn().mockImplementation(async _arg => undefined)
const firstDummyFilter: LocalFilterCreator = () => ({
  name: 'firstDummyFilter',
  onFetch: () => onFetchMock(1),
})

const secondDummyFilter: LocalFilterCreator = () => ({
  name: 'secondDummyFilter',
  onFetch: () => onFetchMock(2),
})

const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}

describe('Adapter', () => {
  const client = createClient()
  const config = {
    fetch: {
      include: fullQueryParams(),
      exclude: {
        types: [
          { name: 'account', ids: ['aaa'] },
          { name: 'subsidiary', ids: ['.*'] },
          { name: SAVED_SEARCH },
          { name: TRANSACTION_FORM },
        ],
        fileCabinet: ['^Some/File/Regex$'],
        customRecords: [],
      },
    },
    client: {
      fetchAllTypesAtOnce: true,
      fetchTypeTimeoutInMinutes: 1,
    },
    withPartialDeletion: true,
  }

  const suiteAppImportFileCabinetMock = jest.fn()

  jest.spyOn(suiteAppFileCabinet, 'createSuiteAppFileCabinetOperations').mockReturnValue({
    importFileCabinet: suiteAppImportFileCabinetMock,
  } as unknown as SuiteAppFileCabinetOperations)

  const netsuiteAdapter = new NetsuiteAdapter({
    client: new NetsuiteClient(client),
    elementsSource: buildElementsSourceFromElements([]),
    filtersCreators: [firstDummyFilter, secondDummyFilter, resolveValuesFilter],
    config,
    getElemIdFunc: mockGetElemIdFunc,
  })

  const mockFetchOpts: MockInterface<FetchOptions> = {
    progressReporter: { reportProgress: jest.fn() },
  }

  const { standardTypes, additionalTypes, innerAdditionalTypes } = getMetadataTypes()
  const metadataTypes = metadataTypesToList({ standardTypes, additionalTypes, innerAdditionalTypes }).concat(
    createCustomRecordTypes([], standardTypes.customrecordtype.type),
  )

  const getSystemInformationMock = jest.fn().mockResolvedValue({
    time: new Date(1000),
    appVersion: [0, 1, 0],
  })

  const getConfigRecordsMock = jest.fn()
  const getCustomRecordsMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    client.listInstances = mockFunction<SdfClient['listInstances']>().mockResolvedValue([])
    client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>().mockResolvedValue({
      elements: [],
      instancesIds: [],
      failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      failedToFetchAllAtOnce: false,
    })
    client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>().mockResolvedValue({
      elements: [],
      failedPaths: { lockedError: [], otherError: [], largeFolderError: [] },
    })

    suiteAppImportFileCabinetMock.mockResolvedValue({ elements: [], failedPaths: [] })
  })

  describe('fetch', () => {
    it('should fetch all types and instances that are not in fetch.exclude', async () => {
      const mockElementsSource = buildElementsSourceFromElements([])
      const folderCustomizationInfo: FolderCustomizationInfo = {
        typeName: FOLDER,
        values: {},
        path: ['a', 'b'],
      }

      const fileCustomizationInfo: FileCustomizationInfo = {
        typeName: FILE,
        values: {},
        path: ['a', 'b'],
        fileContent: Buffer.from('Dummy content'),
      }

      const featuresCustomTypeInfo: CustomTypeInfo = {
        typeName: CONFIG_FEATURES,
        scriptId: CONFIG_FEATURES,
        values: {
          feature: [{ id: 'feature', label: 'Feature', status: 'ENABLED' }],
        },
      }

      const customTypeInfo = {
        typeName: 'entitycustomfield',
        values: {
          '@_scriptid': 'custentity_my_script_id',
          label: 'elementName',
        },
        scriptId: 'custentity_my_script_id',
      }

      client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>().mockResolvedValue({
        elements: [folderCustomizationInfo, fileCustomizationInfo],
        failedPaths: { lockedError: [], otherError: [], largeFolderError: [] },
      })
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>().mockResolvedValue({
        elements: [customTypeInfo, featuresCustomTypeInfo],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      })
      const { elements, partialFetchData } = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(partialFetchData?.isPartial).toBeFalsy()
      const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
      const typesToSkip = [SAVED_SEARCH, TRANSACTION_FORM, INTEGRATION, REPORT_DEFINITION, FINANCIAL_LAYOUT]
      expect(_.pull(getStandardTypesNames(), ...typesToSkip).every(customObjectsQuery.isTypeMatch)).toBeTruthy()
      expect(typesToSkip.every(customObjectsQuery.isTypeMatch)).toBeFalsy()
      expect(customObjectsQuery.isTypeMatch('subsidiary')).toBeFalsy()
      expect(customObjectsQuery.isTypeMatch('account')).toBeTruthy()

      const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
      expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
      expect(fileCabinetQuery.isFileMatch('Some/anotherFile/Regex')).toBeTruthy()

      // metadataTypes + folderInstance + fileInstance + featuresInstance + customTypeInstance
      expect(elements).toHaveLength(metadataTypes.length + 4)

      const customFieldType = elements.find(element =>
        element.elemID.isEqual(new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD)),
      )
      expect(isObjectType(customFieldType)).toBeTruthy()
      expect(elements).toContainEqual(
        await createInstanceElement(
          customTypeInfo,
          customFieldType as ObjectType,
          mockElementsSource,
          mockGetElemIdFunc,
        ),
      )

      const file = elements.find(element => element.elemID.isEqual(new ElemID(NETSUITE, FILE)))
      expect(isObjectType(file)).toBeTruthy()
      expect(elements).toContainEqual(
        await createInstanceElement(fileCustomizationInfo, file as ObjectType, mockElementsSource, mockGetElemIdFunc),
      )

      const folder = elements.find(element => element.elemID.isEqual(new ElemID(NETSUITE, FOLDER)))
      expect(isObjectType(folder)).toBeTruthy()
      expect(elements).toContainEqual(
        await createInstanceElement(
          folderCustomizationInfo,
          folder as ObjectType,
          mockElementsSource,
          mockGetElemIdFunc,
        ),
      )

      const featuresType = elements.find(element => element.elemID.isEqual(new ElemID(NETSUITE, CONFIG_FEATURES)))
      expect(isObjectType(featuresType)).toBeTruthy()
      expect(elements).toContainEqual(
        await createInstanceElement(
          featuresCustomTypeInfo,
          featuresType as ObjectType,
          mockElementsSource,
          mockGetElemIdFunc,
        ),
      )

      expect(suiteAppImportFileCabinetMock).not.toHaveBeenCalled()
    })

    describe('fetchConfig', () => {
      const createAdapter = (configInput: NetsuiteConfig): NetsuiteAdapter =>
        new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configInput,
          getElemIdFunc: mockGetElemIdFunc,
        })
      it('should fetch all types and instances without those in Types To Skip, skipList and exclude when fetch config, skipList and typeToSkip are defined', async () => {
        const configWithAllFormats = {
          ...config,
          skipList: {
            types: {
              typeToSkip: ['.*'],
            },
            filePaths: ['someFilePathToSkip'],
          },
          typesToSkip: ['skipThisType'],
        }
        const adapter = createAdapter(configWithAllFormats)
        const { partialFetchData } = await adapter.fetch(mockFetchOpts)
        expect(partialFetchData?.isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch('typeToSkip')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('skipThisType')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('subsidiary')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('account')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch(SAVED_SEARCH)).toBeFalsy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeTruthy()
        expect(fileCabinetQuery.isFileMatch('someFilePathToSkip')).toBeFalsy()
        expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
      })
    })

    describe('fetchWithChangesDetection', () => {
      const withChangesDetection = true
      const conf = {
        fetch: {
          include: fullQueryParams(),
          exclude: {
            types: [{ name: SAVED_SEARCH }, { name: TRANSACTION_FORM }],
            fileCabinet: ['Some/File/Regex'],
            customRecords: [],
          },
        },
      }
      const dummyElement = new ObjectType({ elemID: new ElemID('dum', 'test') })
      const adapter = new NetsuiteAdapter({
        client: new NetsuiteClient(client),
        elementsSource: buildElementsSourceFromElements([dummyElement]),
        filtersCreators: [firstDummyFilter, secondDummyFilter],
        config: conf,
        getElemIdFunc: mockGetElemIdFunc,
      })

      it('isPartial should be true', async () => {
        const { partialFetchData } = await adapter.fetch({ ...mockFetchOpts, withChangesDetection })
        expect(partialFetchData?.isPartial).toBeTruthy()
      })
    })

    describe('fetchTarget', () => {
      const conf = {
        fetch: {
          include: fullQueryParams(),
          exclude: {
            types: [{ name: SAVED_SEARCH }, { name: TRANSACTION_FORM }],
            fileCabinet: ['Some/File/Regex'],
            customRecords: [],
          },
        },
        fetchTarget: {
          types: {
            [SAVED_SEARCH]: ['.*'],
            addressForm: ['.*'],
          },
          filePaths: ['Some/File/.*'],
        },
      }

      describe('define fetchTarget for the first fetch', () => {
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: conf,
          getElemIdFunc: mockGetElemIdFunc,
        })

        it('should throw an error when defining fetchTarget for the first fetch', async () => {
          await expect(() => adapter.fetch(mockFetchOpts)).rejects.toThrow(
            "Can't define fetchTarget for the first fetch. Remove fetchTarget from adapter config file",
          )
        })
      })

      describe('define fetchTarget after a full fetch', () => {
        const dummyElement = new ObjectType({ elemID: new ElemID('dum', 'test') })
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([dummyElement]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: conf,
          getElemIdFunc: mockGetElemIdFunc,
        })

        it('isPartial should be true', async () => {
          const { partialFetchData } = await adapter.fetch(mockFetchOpts)
          expect(partialFetchData?.isPartial).toBeTruthy()
        })

        it('should match the types that match fetchTarget and exclude', async () => {
          await adapter.fetch(mockFetchOpts)

          const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
          expect(customObjectsQuery.isTypeMatch('addressForm')).toBeTruthy()
          expect(
            _.pull(getStandardTypesNames(), 'addressForm', SAVED_SEARCH, TRANSACTION_FORM).some(
              customObjectsQuery.isTypeMatch,
            ),
          ).toBeFalsy()
          expect(customObjectsQuery.isTypeMatch(INTEGRATION)).toBeFalsy()
        })

        it('should match the files that match fetchTarget and not in filePathRegexSkipList', async () => {
          await adapter.fetch(mockFetchOpts)

          const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
          expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
          expect(fileCabinetQuery.isFileMatch('Some/AnotherFile/another')).toBeFalsy()
          expect(fileCabinetQuery.isFileMatch('Some/File/another')).toBeTruthy()
        })
      })
    })

    it('should filter large file cabinet folders', async () => {
      client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>().mockResolvedValue({
        elements: [],
        failedPaths: { lockedError: [], otherError: [], largeFolderError: ['largeFolder'] },
      })

      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: { lockedError: [], otherError: [], largeFolderError: ['largeFolder'] },
          failedTypes: expect.anything(),
          failedCustomRecords: expect.anything(),
          largeSuiteQLTables: [],
        },
        config,
      )
    })

    it('should filter types with too many instances from SDF', async () => {
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>().mockResolvedValue({
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: ['excludedTypeTest'] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      getConfigFromConfigChangesMock.mockReturnValue(undefined)
      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: ['excludedTypeTest'] },
          failedCustomRecords: [],
          largeSuiteQLTables: [],
        },
        config,
      )
    })

    it('should fail when getCustomObjects fails', async () => {
      client.getCustomObjects = jest.fn().mockImplementation(async () => {
        throw new Error('Dummy error')
      })
      await expect(netsuiteAdapter.fetch(mockFetchOpts)).rejects.toThrow()
    })

    it('should fail when importFileCabinetContent fails', async () => {
      client.importFileCabinetContent = jest.fn().mockImplementation(async () => {
        throw new Error('Dummy error')
      })
      await expect(netsuiteAdapter.fetch(mockFetchOpts)).rejects.toThrow()
    })

    it('should ignore instances of unknown type', async () => {
      const customTypeInfo = {
        typeName: 'unknowntype',
        values: {
          label: 'elementName',
        },
        scriptId: 'unknown',
      }
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>().mockResolvedValue({
        elements: [customTypeInfo],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      })
      const { elements } = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(elements).toHaveLength(metadataTypes.length)
    })

    it('should call filters by their order', async () => {
      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(onFetchMock).toHaveBeenNthCalledWith(1, 1)
      expect(onFetchMock).toHaveBeenNthCalledWith(2, 2)
    })

    it('should call getCustomObjects with query that matches types that match the types in fetch config', async () => {
      await netsuiteAdapter.fetch(mockFetchOpts)
      const query = (client.getCustomObjects as jest.Mock).mock.calls[0][1].updatedFetchQuery
      expect(query.isTypeMatch(ENTITY_CUSTOM_FIELD)).toBeTruthy()
      expect(query.isTypeMatch(SAVED_SEARCH)).toBeFalsy()
    })

    it('should return only the elements when having no config changes', async () => {
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      getConfigFromConfigChangesMock.mockReturnValue(undefined)
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
          failedCustomRecords: [],
          largeSuiteQLTables: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig).toBeUndefined()
    })

    it('should call getConfigFromConfigChanges with failed file paths', async () => {
      client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>().mockResolvedValue({
        elements: [],
        failedPaths: { lockedError: [], otherError: ['/path/to/file'], largeFolderError: [] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: { lockedError: [], otherError: ['/path/to/file'], largeFolderError: [] },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
          failedCustomRecords: [],
          largeSuiteQLTables: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with failedTypeToInstances', async () => {
      const failedTypeToInstances = { testType: ['scriptid1', 'scriptid1'] }
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>().mockResolvedValue({
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { lockedError: {}, unexpectedError: failedTypeToInstances, excludedTypes: [] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: false,
          failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
          failedTypes: { lockedError: {}, unexpectedError: failedTypeToInstances, excludedTypes: [] },
          failedCustomRecords: [],
          largeSuiteQLTables: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with false for fetchAllAtOnce', async () => {
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>().mockResolvedValue({
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: true,
        failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        {
          failedToFetchAllAtOnce: true,
          failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
          failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
          failedCustomRecords: [],
          largeSuiteQLTables: [],
        },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })
  })

  describe('deploy', () => {
    const origInstance = new InstanceElement('elementName', standardTypes[ENTITY_CUSTOM_FIELD].type, {
      label: 'elementName',
      [SCRIPT_ID]: 'custentity_my_script_id',
      description: new StaticFile({
        filepath: 'netsuite/elementName.suffix',
        content: Buffer.from('description value'),
      }),
    })
    let instance: InstanceElement

    const fileInstance = new InstanceElement('fileInstance', additionalTypes[FILE], {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
    })

    const folderInstance = new InstanceElement('folderInstance', additionalTypes[FOLDER], {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
    })
    let testGraph: Graph<SDFObjectNode>

    beforeEach(() => {
      instance = origInstance.clone()
      client.deploy = jest.fn().mockImplementation(() => Promise.resolve())
      testGraph = new Graph()
    })

    const adapterAdd = (after: ChangeDataType): Promise<DeployResult> =>
      netsuiteAdapter.deploy({
        changeGroup: {
          groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
          changes: [{ action: 'add', data: { after } }],
        },
        progressReporter: nullProgressReporter,
      })

    describe('add', () => {
      it('should add custom type instance', async () => {
        const result = await adapterAdd(instance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = Buffer.from('description value')
        const customizationInfo = await toCustomizationInfo(expectedResolvedInstance)
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'addition',
            customizationInfo,
            change: toChange({ after: expectedResolvedInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post.isEqual(instance)).toBe(true)
      })

      it('should add file instance', async () => {
        const result = await adapterAdd(fileInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(fileInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: serviceId,
            changeType: 'addition',
            customizationInfo,
            change: toChange({ after: fileInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post.isEqual(fileInstance)).toBe(true)
      })

      it('should add folder instance', async () => {
        const result = await adapterAdd(folderInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(folderInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        testGraph.addNodes([
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: serviceId,
            changeType: 'addition',
            customizationInfo,
            change: toChange({ after: folderInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post.isEqual(folderInstance)).toBe(true)
      })

      it('should support deploying multiple changes at once', async () => {
        const fileChange = toChange({ after: fileInstance })
        const folderChange = toChange({ after: folderInstance })
        const result = await netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [fileChange, folderChange],
          },
          progressReporter: nullProgressReporter,
        })
        const folderCustInfo = await toCustomizationInfo(folderInstance)
        const fileCustInfo = await toCustomizationInfo(fileInstance)
        const folderServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        const fileServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: fileServiceId,
            changeType: 'addition',
            customizationInfo: fileCustInfo,
            change: fileChange,
          }),
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: folderServiceId,
            changeType: 'addition',
            customizationInfo: folderCustInfo,
            change: folderChange,
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
      })

      it('should return correct DeployResult in case of failure', async () => {
        const clientError = new Error('some client error')
        client.deploy = jest.fn().mockRejectedValue(clientError)
        const fileChange = toChange({ after: fileInstance })
        const folderChange = toChange({ after: folderInstance })
        const result = await netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [fileChange, folderChange],
          },
          progressReporter: nullProgressReporter,
        })
        const folderCustInfo = await toCustomizationInfo(folderInstance)
        const fileCustInfo = await toCustomizationInfo(fileInstance)
        const folderServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        const fileServiceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: fileServiceId,
            changeType: 'addition',
            customizationInfo: fileCustInfo,
            change: fileChange,
          }),
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: folderServiceId,
            changeType: 'addition',
            customizationInfo: folderCustInfo,
            change: folderChange,
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(result.errors).toHaveLength(1)
        expect(result.errors).toEqual([{ message: clientError.message, severity: 'Error' }])
        expect(result.appliedChanges).toHaveLength(0)
      })
    })

    describe('update', () => {
      const adapterUpdate = (before: ChangeDataType, after: ChangeDataType): Promise<DeployResult> =>
        netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [{ action: 'modify', data: { before, after } }],
          },
          progressReporter: nullProgressReporter,
        })

      it('should update custom type instance', async () => {
        const result = await adapterUpdate(instance, instance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = Buffer.from('description value')
        const customizationInfo = await toCustomizationInfo(expectedResolvedInstance)
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({
              before: instance,
              after: expectedResolvedInstance,
            }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(instance)
      })

      it('should update file instance', async () => {
        const result = await adapterUpdate(fileInstance, fileInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(fileInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html'
        testGraph.addNodes([
          new GraphNode('netsuite.file.instance.fileInstance', {
            serviceid: serviceId,
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({ before: fileInstance, after: fileInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(fileInstance)
      })

      it('should update folder instance', async () => {
        const result = await adapterUpdate(folderInstance, folderInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        const customizationInfo = await toCustomizationInfo(folderInstance)
        const serviceId = 'Templates/E-mail Templates/Inner EmailTemplates Folder'
        testGraph.addNodes([
          new GraphNode('netsuite.folder.instance.folderInstance', {
            serviceid: serviceId,
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({ before: folderInstance, after: folderInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(folderInstance)
      })

      it('should restore static file', async () => {
        const after = instance.clone()
        after.value.description = new StaticFile({
          filepath: 'netsuite/elementName.suffix',
          content: Buffer.from('edited description value'),
        })
        const result = await adapterUpdate(instance, after)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedAfter = after.clone()
        expectedResolvedAfter.value.description = Buffer.from('edited description value')
        const customizationInfo = await toCustomizationInfo(expectedResolvedAfter)
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'modification',
            addedObjects: new Set(),
            customizationInfo,
            change: toChange({
              before: instance,
              after: expectedResolvedAfter,
            }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
        expect(post).toEqual(after)
      })
    })
    describe('additional sdf dependencies', () => {
      let expectedResolvedInstance: InstanceElement
      let custInfo: CustomizationInfo
      beforeAll(async () => {
        expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = Buffer.from('description value')
        custInfo = await toCustomizationInfo(expectedResolvedInstance)
      })
      it('should call deploy with additional dependencies', async () => {
        const configWithAdditionalSdfDependencies = {
          typesToSkip: [SAVED_SEARCH, TRANSACTION_FORM],
          fetchAllTypesAtOnce: true,
          deploy: {
            additionalDependencies: {
              include: {
                objects: ['addedObject'],
                features: ['addedFeature'],
              },
            },
          },
          fetch: fullFetchConfig(),
        }
        const netsuiteAdapterWithAdditionalSdfDependencies = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter, resolveValuesFilter],
          config: configWithAdditionalSdfDependencies,
          getElemIdFunc: mockGetElemIdFunc,
        })

        await netsuiteAdapterWithAdditionalSdfDependencies.deploy({
          changeGroup: {
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
            changes: [{ action: 'add', data: { after: instance } }],
          },
          progressReporter: nullProgressReporter,
        })
        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'addition',
            customizationInfo: custInfo,
            change: toChange({ after: expectedResolvedInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(
          undefined,
          {
            ...DEFAULT_SDF_DEPLOY_PARAMS,
            manifestDependencies: {
              ...DEFAULT_SDF_DEPLOY_PARAMS.manifestDependencies,
              includedObjects: ['addedObject'],
              optionalFeatures: ['addedFeature'],
            },
          },
          testGraph,
        )
      })

      it('should call deploy without additional dependencies', async () => {
        await adapterAdd(instance)

        testGraph.addNodes([
          new GraphNode('netsuite.entitycustomfield.instance.elementName', {
            serviceid: 'custentity_my_script_id',
            changeType: 'addition',
            customizationInfo: custInfo,
            change: toChange({ after: expectedResolvedInstance }),
          }),
        ])
        expect(client.deploy).toHaveBeenCalledWith(undefined, DEFAULT_SDF_DEPLOY_PARAMS, testGraph)
      })
    })

    describe('warnOnStaleWorkspaceData', () => {
      it('should call getChangeValidator with warnStaleData=false if warnOnStaleWorkspaceData is undefined in config', async () => {
        const configWithoutWarnStaleData = {
          typesToSkip: [SAVED_SEARCH, TRANSACTION_FORM],
          fetchAllTypesAtOnce: true,
          deploy: {},
          fetch: fullFetchConfig(),
        }
        const elementsSource = buildElementsSourceFromElements([])
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithoutWarnStaleData,
          getElemIdFunc: mockGetElemIdFunc,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        adapter.deployModifiers

        expect(getChangeValidatorMock).toHaveBeenCalledWith(
          expect.objectContaining({
            warnStaleData: false,
          }),
        )
      })

      it('should call getChangeValidator with warnStaleData=false if warnOnStaleWorkspaceData=false in config', async () => {
        const configWithoutWarnStaleData = {
          typesToSkip: [SAVED_SEARCH, TRANSACTION_FORM],
          fetchAllTypesAtOnce: true,
          deploy: {
            warnOnStaleWorkspaceData: false,
          },
          fetch: fullFetchConfig(),
        }
        const elementsSource = buildElementsSourceFromElements([])
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithoutWarnStaleData,
          getElemIdFunc: mockGetElemIdFunc,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        adapter.deployModifiers

        expect(getChangeValidatorMock).toHaveBeenCalledWith(
          expect.objectContaining({
            warnStaleData: false,
          }),
        )
      })

      it('should call getChangeValidator with warnStaleData=true if warnOnStaleWorkspaceData=true in config', async () => {
        const configWithoutWarnStaleData = {
          typesToSkip: [SAVED_SEARCH, TRANSACTION_FORM],
          fetchAllTypesAtOnce: true,
          deploy: {
            warnOnStaleWorkspaceData: true,
          },
          fetch: fullFetchConfig(),
        }
        const elementsSource = buildElementsSourceFromElements([])
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithoutWarnStaleData,
          getElemIdFunc: mockGetElemIdFunc,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        adapter.deployModifiers

        expect(getChangeValidatorMock).toHaveBeenCalledWith(
          expect.objectContaining({
            warnStaleData: true,
          }),
        )
      })
    })

    describe('deploy errors', () => {
      let adapter: NetsuiteAdapter
      const mockClientDeploy = jest.fn()
      beforeEach(() => {
        adapter = new NetsuiteAdapter({
          client: { deploy: mockClientDeploy } as unknown as NetsuiteClient,
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [],
          config: { fetch: fullFetchConfig() },
        })
      })
      it('should return correct deploy errors', async () => {
        const customSegment = new InstanceElement('cseg1', standardTypes.customsegment.type)
        const customRecordType = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord_cseg1'),
          fields: {
            custom_field: { refType: BuiltinTypes.STRING },
          },
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          },
        })
        const errors: (SaltoError | SaltoElementError)[] = [
          // general SaltoError
          {
            message: 'General error',
            severity: 'Error',
          },
          // field SaltoElementError
          {
            elemID: customRecordType.fields.custom_field.elemID,
            message: 'Custom Field Error',
            severity: 'Error',
          },
          // should be ignored (duplicates the field error)
          {
            elemID: customRecordType.elemID,
            message: 'Custom Field Error',
            severity: 'Error',
          },
          // should be transformed to a SaltoError
          {
            elemID: customSegment.elemID,
            message: 'Custom Segment Error',
            severity: 'Error',
          },
        ]
        mockClientDeploy.mockResolvedValue({ appliedChanges: [], errors })
        const deployRes = await adapter.deploy({
          changeGroup: {
            changes: [toChange({ after: customRecordType.fields.custom_field })],
            groupID: SDF_CREATE_OR_UPDATE_GROUP_ID,
          },
          progressReporter: nullProgressReporter,
        })
        expect(deployRes).toEqual({
          appliedChanges: [],
          errors: [
            {
              elemID: customRecordType.fields.custom_field.elemID,
              message: 'Custom Field Error',
              severity: 'Error',
            },
            {
              message: 'General error',
              severity: 'Error',
            },
            {
              message: 'Custom Segment Error',
              severity: 'Error',
            },
          ],
        })
      })
    })
  })

  describe('SuiteAppClient', () => {
    let adapter: NetsuiteAdapter

    const dummyElement = new ObjectType({ elemID: new ElemID('dum', 'test') })
    const elementsSource = buildElementsSourceFromElements([dummyElement])
    const getElementMock = jest.spyOn(elementsSource, 'get')
    const getChangedObjectsMock = jest.spyOn(changesDetector, 'getChangedObjects')
    const getDeletedElementsMock = jest.spyOn(deletionCalculator, 'getDeletedElements')

    beforeEach(() => {
      getElementMock.mockReset()

      getChangedObjectsMock.mockReset()
      getChangedObjectsMock.mockResolvedValue({
        isTypeMatch: () => true,
        areAllObjectsMatch: () => false,
        isObjectMatch: objectID => objectID.instanceId.startsWith('aa'),
        isFileMatch: () => true,
        isParentFolderMatch: () => true,
        areSomeFilesMatch: () => true,
        isCustomRecordTypeMatch: () => true,
        areAllCustomRecordsMatch: () => true,
        isCustomRecordMatch: () => true,
      })

      getDeletedElementsMock.mockReset()
      getDeletedElementsMock.mockResolvedValue({})

      getSystemInformationMock.mockReset()
      getSystemInformationMock.mockResolvedValue({
        time: new Date(1000),
        appVersion: [0, 1, 0],
      })

      getCustomRecordsMock.mockReset()
      getCustomRecordsMock.mockResolvedValue({
        customRecords: [
          {
            type: 'testtype',
            records: [],
          },
        ],
        largeTypesError: [],
      })

      const suiteAppClient = {
        getSystemInformation: getSystemInformationMock,
        getNetsuiteWsdl: () => undefined,
        getConfigRecords: () => [],
        runSavedSearchQuery: () => [],
        runSuiteQL: () => [],
        getInstalledBundles: () => [],
        getCustomRecords: getCustomRecordsMock,
      } as unknown as SuiteAppClient

      adapter = new NetsuiteAdapter({
        client: new NetsuiteClient(client, suiteAppClient),
        elementsSource,
        filtersCreators: [firstDummyFilter, secondDummyFilter],
        config,
        getElemIdFunc: mockGetElemIdFunc,
      })
    })

    it('should use suiteapp_file_cabinet importFileCabinet', async () => {
      await adapter.fetch(mockFetchOpts)
      expect(suiteAppImportFileCabinetMock).toHaveBeenCalled()
    })

    it('should not create serverTime elements when getSystemInformation returns undefined', async () => {
      getSystemInformationMock.mockResolvedValue(undefined)

      const { elements } = await adapter.fetch(mockFetchOpts)
      expect(elements.filter(e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME))).toHaveLength(0)
    })

    it('should create the serverTime elements when getSystemInformation returns the time', async () => {
      const { elements } = await adapter.fetch(mockFetchOpts)
      expect(elements.filter(e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME))).toHaveLength(2)

      const serverTimeInstance = elements.find(e =>
        e.elemID.isEqual(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)),
      )
      expect((serverTimeInstance as InstanceElement)?.value?.serverTime).toEqual(new Date(1000).toJSON())
      expect(getChangedObjectsMock).not.toHaveBeenCalled()
    })

    describe('getChangedObjects', () => {
      let suiteAppClient: SuiteAppClient

      beforeEach(() => {
        getElementMock.mockResolvedValue(
          new InstanceElement(
            ElemID.CONFIG_NAME,
            new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) }),
            {
              serverTime: '1970-01-01T00:00:00.500Z',
            },
          ),
        )

        suiteAppClient = {
          getSystemInformation: getSystemInformationMock,
          getNetsuiteWsdl: () => undefined,
          getConfigRecords: getConfigRecordsMock.mockReturnValue([
            {
              configType: 'USER_PREFERENCES',
              fieldsDef: [],
              data: { fields: { DATEFORMAT: 'YYYY-MM-DD', TIMEFORMAT: 'hh:m a' } },
            },
          ]),
          getInstalledBundles: () => [],
          getCustomRecords: getCustomRecordsMock,
          runSuiteQL: () => [],
        } as unknown as SuiteAppClient

        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            fetchTarget: {
              types: {
                workflow: ['.*'],
              },
              filePaths: [],
            },
          },
          getElemIdFunc: mockGetElemIdFunc,
        })
      })
      it('should call getChangedObjects with the right date range', async () => {
        await adapter.fetch(mockFetchOpts)
        expect(getElementMock).toHaveBeenCalledWith(
          new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
        )
        expect(getChangedObjectsMock).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            start: new Date('1970-01-01T00:00:00.500Z'),
            end: new Date(1000),
          }),
          expect.any(Object),
        )
      })

      it('should not call getChangedObjects if date format is undefind', async () => {
        getConfigRecordsMock.mockReturnValue([
          {
            configType: SUITEAPP_CONFIG_RECORD_TYPES[0],
            fieldsDef: [],
            data: { fields: { DATEFORMAT: undefined, TIMEFORMAT: 'hh:m a' } },
          },
        ])
        await adapter.fetch(mockFetchOpts)
        expect(getChangedObjectsMock).toHaveBeenCalledTimes(0)
      })

      it('should pass the received query to the client', async () => {
        const getCustomObjectsMock = jest.spyOn(client, 'getCustomObjects')
        await adapter.fetch(mockFetchOpts)

        const passedQuery = getCustomObjectsMock.mock.calls[0][1].updatedFetchQuery
        expect(passedQuery.isObjectMatch({ instanceId: 'aaaa', type: 'workflow' })).toBeTruthy()
        expect(passedQuery.isObjectMatch({ instanceId: 'bbbb', type: 'workflow' })).toBeFalsy()
      })

      it('should not call getChangedObjectsMock if server time instance is invalid', async () => {
        getElementMock.mockResolvedValue(
          new InstanceElement(
            ElemID.CONFIG_NAME,
            new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) }),
            {},
          ),
        )
        await adapter.fetch(mockFetchOpts)
        expect(getElementMock).toHaveBeenCalledWith(
          new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
        )
        expect(getChangedObjectsMock).not.toHaveBeenCalled()
      })

      it('should not call getChangedObjects if useChangesDetection is false', async () => {
        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            fetchTarget: {
              types: {
                workflow: ['.*'],
              },
              filePaths: [],
            },
            useChangesDetection: false,
          },
          getElemIdFunc: mockGetElemIdFunc,
        })

        await adapter.fetch(mockFetchOpts)
        expect(getChangedObjectsMock).not.toHaveBeenCalled()
      })

      it('should call getChangedObjects even if fetchTarget is not defined', async () => {
        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            useChangesDetection: true,
          },
          getElemIdFunc: mockGetElemIdFunc,
        })

        await adapter.fetch(mockFetchOpts)
        expect(getChangedObjectsMock).toHaveBeenCalled()
      })
    })

    describe('filter types with too many instances', () => {
      beforeEach(() => {
        const getDataElementsMock = getDataElements as jest.Mock
        getDataElementsMock.mockResolvedValue({
          elements: [],
          largeTypesError: ['excludedTypeDataElements'],
        })

        getCustomRecordsMock.mockResolvedValue({
          customRecords: [],
          largeTypesError: ['excludedTypeCustomRecord'],
        })
      })

      it('should filter from data elements and custom records', async () => {
        await adapter.fetch(mockFetchOpts)
        expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
          {
            failedToFetchAllAtOnce: false,
            failedFilePaths: expect.anything(),
            failedTypes: {
              lockedError: {},
              unexpectedError: {},
              excludedTypes: ['excludedTypeDataElements'],
            },
            failedCustomRecords: ['excludedTypeCustomRecord'],
            largeSuiteQLTables: [],
          },
          config,
        )
      })
    })

    describe('call getDeletedElements and process result', () => {
      const spy = jest.spyOn(elementsSourceIndexModule, 'createElementsSourceIndex')
      let elemId: ElemID
      beforeEach(() => {
        elemId = new ElemID(NETSUITE, ROLE)
        getDeletedElementsMock.mockReset()
        getDeletedElementsMock.mockResolvedValue({ deletedElements: [elemId] })
      })

      it('check call getDeletedElements and verify return value', async () => {
        const { partialFetchData } = await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(getDeletedElementsMock).toHaveBeenCalled()
        expect(partialFetchData?.deletedElements).toEqual([elemId])
        expect(spy).toHaveBeenCalledWith(expect.anything(), true, [elemId])
      })
    })

    describe('do not call getDeletedElements on full fetch', () => {
      const spy = jest.spyOn(elementsSourceIndexModule, 'createElementsSourceIndex')
      let elemId: ElemID
      beforeEach(() => {
        elemId = new ElemID(NETSUITE, ROLE)
        getDeletedElementsMock.mockReset()
        getDeletedElementsMock.mockResolvedValue({ deletedElements: [elemId] })
      })

      it('check call getDeletedElements and verify return value', async () => {
        const { partialFetchData } = await adapter.fetch({ ...mockFetchOpts })
        expect(getDeletedElementsMock).not.toHaveBeenCalled()
        expect(partialFetchData?.deletedElements).toEqual(undefined)
        expect(spy).toHaveBeenCalledWith(expect.anything(), false, [])
      })
    })
  })
})
