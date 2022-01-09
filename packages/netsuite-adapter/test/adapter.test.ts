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

import { ElemID, InstanceElement, StaticFile, ChangeDataType, DeployResult,
  getChangeData, FetchOptions, ObjectType, Change } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import createClient from './client/sdf_client'
import NetsuiteAdapter from '../src/adapter'
import { customTypes, fileCabinetTypes, getMetadataTypes } from '../src/types'
import {
  ENTITY_CUSTOM_FIELD, SCRIPT_ID, SAVED_SEARCH, FILE, FOLDER, PATH, TRANSACTION_FORM, TYPES_TO_SKIP,
  FETCH_ALL_TYPES_AT_ONCE, DEPLOY_REFERENCED_ELEMENTS,
  FETCH_TYPE_TIMEOUT_IN_MINUTES, INTEGRATION, CLIENT_CONFIG, FETCH_TARGET, NETSUITE,
  USE_CHANGES_DETECTION, FETCH, EXCLUDE, INCLUDE, SKIP_LIST, DEPLOY, WARN_STALE_DATA,
} from '../src/constants'
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import SdfClient, { convertToCustomTypeInfo } from '../src/client/sdf_client'
import { FilterCreator } from '../src/filter'
import { configType, getConfigFromConfigChanges, NetsuiteConfig } from '../src/config'
import { mockGetElemIdFunc } from './utils'
import * as referenceDependenciesModule from '../src/reference_dependencies'
import NetsuiteClient from '../src/client/client'
import { FileCustomizationInfo, FolderCustomizationInfo } from '../src/client/types'
import * as changesDetector from '../src/changes_detector/changes_detector'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { SERVER_TIME_TYPE_NAME } from '../src/server_time'
import * as suiteAppFileCabinet from '../src/suiteapp_file_cabinet'
import { SDF_CHANGE_GROUP_ID } from '../src/group_changes'
import { SuiteAppFileCabinetOperations } from '../src/suiteapp_file_cabinet'
import getChangeValidator from '../src/change_validator'
import { FetchByQueryFunc } from '../src/change_validators/safe_deploy'

jest.mock('../src/config', () => ({
  ...jest.requireActual<{}>('../src/config'),
  getConfigFromConfigChanges: jest.fn(),
}))

jest.mock('../src/change_validator')
const getChangeValidatorMock = getChangeValidator as jest.Mock

// eslint-disable-next-line no-empty-pattern
getChangeValidatorMock.mockImplementation(({}: {
  withSuiteApp: boolean
  warnStaleData: boolean
  fetchByQuery: FetchByQueryFunc
}) => (_changes: ReadonlyArray<Change>) => Promise.resolve([]))

jest.mock('../src/reference_dependencies')
const getAllReferencedInstancesMock = referenceDependenciesModule
  .getAllReferencedInstances as jest.Mock
getAllReferencedInstancesMock
  .mockImplementation((sourceInstances: ReadonlyArray<InstanceElement>) => sourceInstances)

jest.mock('../src/changes_detector/changes_detector')

const getRequiredReferencedInstancesMock = referenceDependenciesModule
  .getRequiredReferencedInstances as jest.Mock
getRequiredReferencedInstancesMock
  .mockImplementation((sourceInstances: ReadonlyArray<InstanceElement>) => sourceInstances)

const onFetchMock = jest.fn().mockImplementation(async _arg => undefined)
const firstDummyFilter: FilterCreator = () => ({
  onFetch: () => onFetchMock(1),
})

const secondDummyFilter: FilterCreator = () => ({
  onFetch: () => onFetchMock(2),
})

describe('Adapter', () => {
  const client = createClient()
  const config = {
    [FETCH]: {
      [EXCLUDE]: {
        types: [
          { name: 'account', ids: ['aaa'] },
          { name: 'subsidiary', ids: ['.*'] },
          { name: SAVED_SEARCH },
          { name: TRANSACTION_FORM },
        ],
        fileCabinet: ['^Some/File/Regex$'],
      },
    },
    [CLIENT_CONFIG]: {
      [FETCH_ALL_TYPES_AT_ONCE]: true,
      [FETCH_TYPE_TIMEOUT_IN_MINUTES]: 1,
    },
  }

  const suiteAppImportFileCabinetMock = jest.fn()

  jest.spyOn(suiteAppFileCabinet, 'createSuiteAppFileCabinetOperations').mockReturnValue({
    importFileCabinet: suiteAppImportFileCabinetMock,
  } as unknown as SuiteAppFileCabinetOperations)

  const netsuiteAdapter = new NetsuiteAdapter({
    client: new NetsuiteClient(client),
    elementsSource: buildElementsSourceFromElements([]),
    filtersCreators: [firstDummyFilter, secondDummyFilter],
    config,
    getElemIdFunc: mockGetElemIdFunc,
  })

  const mockFetchOpts: MockInterface<FetchOptions> = {
    progressReporter: { reportProgress: jest.fn() },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    client.listInstances = mockFunction<SdfClient['listInstances']>()
      .mockResolvedValue([])
    client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>()
      .mockResolvedValue({
        elements: [],
        failedTypes: { lockedError: {}, unexpectedError: {} },
        failedToFetchAllAtOnce: false,
      })
    client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>()
      .mockResolvedValue({
        elements: [],
        failedPaths: { lockedError: [], otherError: [] },
      })

    suiteAppImportFileCabinetMock.mockResolvedValue({ elements: [], failedPaths: [] })
  })

  describe('fetch', () => {
    it('should fetch all types and instances that are not in fetch.exclude', async () => {
      const folderCustomizationInfo: FolderCustomizationInfo = {
        typeName: FOLDER,
        values: {
        },
        path: ['a', 'b'],
      }

      const fileCustomizationInfo: FileCustomizationInfo = {
        typeName: FILE,
        values: {
        },
        path: ['a', 'b'],
        fileContent: Buffer.from('Dummy content'),
      }

      const xmlContent = '<entitycustomfield scriptid="custentity_my_script_id">\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const customTypeInfo = convertToCustomTypeInfo(xmlContent, 'custentity_my_script_id')
      client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>()
        .mockResolvedValue({
          elements: [folderCustomizationInfo, fileCustomizationInfo],
          failedPaths: { lockedError: [], otherError: [] },
        })
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>()
        .mockResolvedValue({
          elements: [customTypeInfo],
          failedToFetchAllAtOnce: false,
          failedTypes: { lockedError: {}, unexpectedError: {} },
        })
      const { elements, isPartial } = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(isPartial).toBeFalsy()
      const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
      const typesToSkip = [SAVED_SEARCH, TRANSACTION_FORM, INTEGRATION]
      expect(_.pull(Object.keys(customTypes), ...typesToSkip).every(customObjectsQuery.isTypeMatch))
        .toBeTruthy()
      expect(typesToSkip.every(customObjectsQuery.isTypeMatch)).toBeFalsy()
      expect(customObjectsQuery.isTypeMatch('subsidiary')).toBeFalsy()
      expect(customObjectsQuery.isTypeMatch('account')).toBeTruthy()


      const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
      expect(fileCabinetQuery.isFileMatch('Some/File/Regex')).toBeFalsy()
      expect(fileCabinetQuery.isFileMatch('Some/anotherFile/Regex')).toBeTruthy()

      expect(elements).toHaveLength(getMetadataTypes().length + 3)
      const customFieldType = customTypes[ENTITY_CUSTOM_FIELD]
      expect(elements).toContainEqual(customFieldType)
      expect(elements).toContainEqual(
        await createInstanceElement(customTypeInfo, customFieldType, mockGetElemIdFunc)
      )
      expect(elements).toContainEqual(
        await createInstanceElement(
          fileCustomizationInfo,
          fileCabinetTypes[FILE],
          mockGetElemIdFunc
        )
      )
      expect(elements).toContainEqual(
        await createInstanceElement(
          folderCustomizationInfo,
          fileCabinetTypes[FOLDER],
          mockGetElemIdFunc
        )
      )

      expect(suiteAppImportFileCabinetMock).not.toHaveBeenCalled()
    })

    describe('fetchConfig', () => {
      const configWithoutFetch = {
        ..._.omit(config, FETCH),
      }
      const createAdapter = (configInput: NetsuiteConfig): NetsuiteAdapter =>
        new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configInput,
          getElemIdFunc: mockGetElemIdFunc,
        })
      it('should fetch all types and instances when fetch config is undefined', async () => {
        const adapter = createAdapter(configWithoutFetch)
        const { elements, isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeFalsy()
        expect(elements).toHaveLength(getMetadataTypes().length)
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeTruthy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeTruthy()
      })
      it('should fetch all types and instances when fetch config is defined with no values', async () => {
        const configWithEmptyDefinedFetch = {
          ...configWithoutFetch,
          [FETCH]: {},
        }
        const adapter = createAdapter(configWithEmptyDefinedFetch)
        const { elements, isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeFalsy()
        expect(elements).toHaveLength(getMetadataTypes().length)
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeTruthy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeTruthy()
      })
      it('should fetch all types and instances in include when exclude config is undefined', async () => {
        const configWithIncludeButNoExclude = {
          ...configWithoutFetch,
          [FETCH]: {
            [INCLUDE]: {
              types: [{ name: 'someType.*' }],
              fileCabinet: ['someFilePath'],
            },
          },
        }
        const adapter = createAdapter(configWithIncludeButNoExclude)
        const { isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('someType')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch('someType1')).toBeTruthy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeFalsy()
        expect(fileCabinetQuery.isFileMatch('someFilePath')).toBeTruthy()
      })
      it('should fetch all types and instances that are not in exclude when include config is undefined', async () => {
        const configWithExcludeButNoInclude = {
          ...configWithoutFetch,
          [FETCH]: {
            [EXCLUDE]: {
              types: [{ name: 'someTypeToSkip.*' }],
              fileCabinet: ['someFilePathToSkip'],
            },
          },
        }
        const adapter = createAdapter(configWithExcludeButNoInclude)
        const { isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch('someTypeToSkip')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('someTypeToSkip1')).toBeFalsy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeTruthy()
        expect(fileCabinetQuery.isFileMatch('someFilePathToSkip')).toBeFalsy()
      })
      it('should fetch all types and instances besides those in skipList or Types To Skip when fetch config is undefined', async () => {
        const configWithSkipListAndTypesToSkip = {
          ...configWithoutFetch,
          [SKIP_LIST]: {
            types: {
              typeToSkip: ['.*'],
            },
            filePaths: ['someFilePathToSkip'],
          },
          [TYPES_TO_SKIP]: ['skipThisType'],
        }
        const adapter = createAdapter(configWithSkipListAndTypesToSkip)
        const { isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
        expect(customObjectsQuery.isTypeMatch('any kind of type')).toBeTruthy()
        expect(customObjectsQuery.isTypeMatch('typeToSkip')).toBeFalsy()
        expect(customObjectsQuery.isTypeMatch('skipThisType')).toBeFalsy()
        const fileCabinetQuery = (client.importFileCabinetContent as jest.Mock).mock.calls[0][0]
        expect(fileCabinetQuery.isFileMatch('any/kind/of/path')).toBeTruthy()
        expect(fileCabinetQuery.isFileMatch('someFilePathToSkip')).toBeFalsy()
      })
      it('should fetch all types and instances without those in Types To Skip, skipList and exclude when fetch config, skipList and typeToSkip are defined', async () => {
        const configWithAllFormats = {
          ...config,
          [SKIP_LIST]: {
            types: {
              typeToSkip: ['.*'],
            },
            filePaths: ['someFilePathToSkip'],
          },
          [TYPES_TO_SKIP]: ['skipThisType'],
        }
        const adapter = createAdapter(configWithAllFormats)
        const { isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeFalsy()
        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
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

    describe('fetchTarget', () => {
      const conf = {
        [FETCH]: {
          [EXCLUDE]: {
            types: [
              { name: SAVED_SEARCH },
              { name: TRANSACTION_FORM },
            ],
            fileCabinet: ['Some/File/Regex'],
          },
        },
        [FETCH_TARGET]: {
          types: {
            [SAVED_SEARCH]: ['.*'],
            addressForm: ['.*'],
          },
          filePaths: ['Some/File/.*'],
        },
      }
      const adapter = new NetsuiteAdapter({
        client: new NetsuiteClient(client),
        elementsSource: buildElementsSourceFromElements([]),
        filtersCreators: [firstDummyFilter, secondDummyFilter],
        config: conf,
        getElemIdFunc: mockGetElemIdFunc,
      })

      it('isPartial should be true', async () => {
        const { isPartial } = await adapter.fetch(mockFetchOpts)
        expect(isPartial).toBeTruthy()
      })

      it('should match the types that match fetchTarget and exclude', async () => {
        await adapter.fetch(mockFetchOpts)

        const customObjectsQuery = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
        expect(customObjectsQuery.isTypeMatch('addressForm')).toBeTruthy()
        expect(_.pull(Object.keys(customTypes), 'addressForm', SAVED_SEARCH, TRANSACTION_FORM).some(customObjectsQuery.isTypeMatch)).toBeFalsy()
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
      const xmlContent = '<unknowntype scriptid="unknown">\n'
        + '  <label>elementName</label>'
        + '</unknowntype>'
      const customTypeInfo = convertToCustomTypeInfo(xmlContent, 'unknown')
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>()
        .mockResolvedValue({
          elements: [customTypeInfo],
          failedToFetchAllAtOnce: false,
          failedTypes: { lockedError: {}, unexpectedError: {} },
        })
      const { elements } = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(elements).toHaveLength(getMetadataTypes().length)
    })

    it('should call filters by their order', async () => {
      await netsuiteAdapter.fetch(mockFetchOpts)
      expect(onFetchMock).toHaveBeenNthCalledWith(1, 1)
      expect(onFetchMock).toHaveBeenNthCalledWith(2, 2)
    })

    it('should call getCustomObjects with query that matches types that match the types in fetch config', async () => {
      await netsuiteAdapter.fetch(mockFetchOpts)
      const query = (client.getCustomObjects as jest.Mock).mock.calls[0][1]
      expect(query.isTypeMatch(ENTITY_CUSTOM_FIELD)).toBeTruthy()
      expect(query.isTypeMatch(SAVED_SEARCH)).toBeFalsy()
    })

    it('should return only the elements when having no config changes', async () => {
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      getConfigFromConfigChangesMock.mockReturnValue(undefined)
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        false,
        { lockedError: [], otherError: [] },
        { lockedError: {}, unexpectedError: {} },
        config,
      )
      expect(fetchResult.updatedConfig).toBeUndefined()
    })

    it('should call getConfigFromConfigChanges with failed file paths', async () => {
      client.importFileCabinetContent = mockFunction<NetsuiteClient['importFileCabinetContent']>()
        .mockResolvedValue({
          elements: [],
          failedPaths: { lockedError: [], otherError: ['/path/to/file'] },
        })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        false,
        { lockedError: [], otherError: ['/path/to/file'] },
        { lockedError: {}, unexpectedError: {} },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with failedTypeToInstances', async () => {
      const failedTypeToInstances = { testType: ['scriptid1', 'scriptid1'] }
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>()
        .mockResolvedValue({
          elements: [],
          failedToFetchAllAtOnce: false,
          failedTypes: { lockedError: {}, unexpectedError: failedTypeToInstances },
        })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        false,
        { lockedError: [], otherError: [] },
        { lockedError: {}, unexpectedError: failedTypeToInstances },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with false for fetchAllAtOnce', async () => {
      client.getCustomObjects = mockFunction<NetsuiteClient['getCustomObjects']>()
        .mockResolvedValue({
          elements: [],
          failedToFetchAllAtOnce: true,
          failedTypes: { lockedError: {}, unexpectedError: {} },
        })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue({ config: [updatedConfig], message: '' })
      const fetchResult = await netsuiteAdapter.fetch(mockFetchOpts)
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(
        true,
        { lockedError: [], otherError: [] },
        { lockedError: {}, unexpectedError: {} },
        config,
      )
      expect(fetchResult.updatedConfig?.config[0].isEqual(updatedConfig)).toBe(true)
    })
  })


  describe('deploy', () => {
    const origInstance = new InstanceElement('elementName',
      customTypes[ENTITY_CUSTOM_FIELD], {
        label: 'elementName',
        [SCRIPT_ID]: 'custentity_my_script_id',
        description: new StaticFile({
          filepath: 'netsuite/elementName.suffix',
          content: Buffer.from('description value'),
        }),
      })
    let instance: InstanceElement

    const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
    })

    const folderInstance = new InstanceElement('folderInstance', fileCabinetTypes[FOLDER], {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
    })

    beforeEach(() => {
      instance = origInstance.clone()
      client.deploy = jest.fn().mockImplementation(() => Promise.resolve())
    })

    const adapterAdd = (after: ChangeDataType): Promise<DeployResult> => netsuiteAdapter.deploy({
      changeGroup: {
        groupID: SDF_CHANGE_GROUP_ID,
        changes: [{ action: 'add', data: { after } }],
      },
    })

    describe('add', () => {
      it('should add custom type instance', async () => {
        const result = await adapterAdd(instance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = 'description value'
        expect(client.deploy)
          .toHaveBeenCalledWith([await toCustomizationInfo(expectedResolvedInstance)], undefined)
        expect(post.isEqual(instance)).toBe(true)
      })

      it('should add file instance', async () => {
        const result = await adapterAdd(fileInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith(
          [await toCustomizationInfo(fileInstance)],
          undefined,
        )
        expect(post.isEqual(fileInstance)).toBe(true)
      })

      it('should add folder instance', async () => {
        const result = await adapterAdd(folderInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith(
          [await toCustomizationInfo(folderInstance)],
          undefined,
        )
        expect(post.isEqual(folderInstance)).toBe(true)
      })

      it('should support deploying multiple changes at once', async () => {
        const result = await netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CHANGE_GROUP_ID,
            changes: [
              { action: 'add', data: { after: fileInstance } },
              { action: 'add', data: { after: folderInstance } },
            ],
          },
        })
        expect(client.deploy).toHaveBeenCalledWith(expect.arrayContaining(
          [await toCustomizationInfo(folderInstance), await toCustomizationInfo(fileInstance)]
        ), undefined)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
      })

      it('should return correct DeployResult in case of failure', async () => {
        const clientError = new Error('some client error')
        client.deploy = jest.fn().mockRejectedValue(clientError)
        const result = await netsuiteAdapter.deploy({
          changeGroup: {
            groupID: SDF_CHANGE_GROUP_ID,
            changes: [
              { action: 'add', data: { after: fileInstance } },
              { action: 'add', data: { after: folderInstance } },
            ],
          },
        })
        expect(client.deploy).toHaveBeenCalledWith(expect.arrayContaining(
          [await toCustomizationInfo(folderInstance), await toCustomizationInfo(fileInstance)]
        ), undefined)
        expect(result.errors).toHaveLength(1)
        expect(result.errors).toEqual([clientError])
        expect(result.appliedChanges).toHaveLength(0)
      })
    })

    describe('update', () => {
      const adapterUpdate = (
        before: ChangeDataType, after: ChangeDataType
      ): Promise<DeployResult> => netsuiteAdapter.deploy({
        changeGroup: {
          groupID: SDF_CHANGE_GROUP_ID,
          changes: [{ action: 'modify', data: { before, after } }],
        },
      })

      it('should update custom type instance', async () => {
        const result = await adapterUpdate(instance, instance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = 'description value'
        expect(client.deploy)
          .toHaveBeenCalledWith(
            [await toCustomizationInfo(expectedResolvedInstance)],
            undefined,
          )
        expect(post).toEqual(instance)
      })

      it('should update file instance', async () => {
        const result = await adapterUpdate(fileInstance, fileInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith(
          [await toCustomizationInfo(fileInstance)],
          undefined,
        )
        expect(post).toEqual(fileInstance)
      })

      it('should update folder instance', async () => {
        const result = await adapterUpdate(folderInstance, folderInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeData(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith(
          [await toCustomizationInfo(folderInstance)],
          undefined,
        )
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
        expectedResolvedAfter.value.description = 'edited description value'
        expect(client.deploy)
          .toHaveBeenCalledWith([await toCustomizationInfo(expectedResolvedAfter)], undefined)
        expect(post).toEqual(after)
      })
    })

    describe('deployReferencedElements', () => {
      it('should call getAllReferencedInstances when deployReferencedElements is set to true', async () => {
        const configWithDeployReferencedElements = {
          [TYPES_TO_SKIP]: [SAVED_SEARCH, TRANSACTION_FORM],
          [FETCH_ALL_TYPES_AT_ONCE]: true,
          [DEPLOY]: {
            [DEPLOY_REFERENCED_ELEMENTS]: true,
          },
        }
        const netsuiteAdapterWithDeployReferencedElements = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithDeployReferencedElements,
          getElemIdFunc: mockGetElemIdFunc,
        })

        await netsuiteAdapterWithDeployReferencedElements.deploy({
          changeGroup: {
            groupID: SDF_CHANGE_GROUP_ID,
            changes: [{ action: 'add', data: { after: instance } }],
          },
        })

        expect(getAllReferencedInstancesMock).toHaveBeenCalledTimes(1)
        expect(getRequiredReferencedInstancesMock).not.toHaveBeenCalled()
      })

      it('should call getRequiredReferencedInstances when deployReferencedElements is set to false', async () => {
        await adapterAdd(instance)
        expect(getRequiredReferencedInstancesMock).toHaveBeenCalledTimes(1)
        expect(getAllReferencedInstancesMock).not.toHaveBeenCalled()
      })
    })

    describe('warnOnStaleWorkspaceData', () => {
      it('should call getChangeValidator with warnStaleData=false if warnOnStaleWorkspaceData is undefined in config', async () => {
        const configWithoutWarnStaleData = {
          [TYPES_TO_SKIP]: [SAVED_SEARCH, TRANSACTION_FORM],
          [FETCH_ALL_TYPES_AT_ONCE]: true,
          [DEPLOY]: {
          },
        }
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithoutWarnStaleData,
          getElemIdFunc: mockGetElemIdFunc,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        adapter.deployModifiers

        expect(getChangeValidatorMock).toHaveBeenCalledWith({
          withSuiteApp: expect.anything(),
          warnStaleData: false,
          fetchByQuery: expect.anything(),
        })
      })

      it('should call getChangeValidator with warnStaleData=false if warnOnStaleWorkspaceData=false in config', async () => {
        const configWithoutWarnStaleData = {
          [TYPES_TO_SKIP]: [SAVED_SEARCH, TRANSACTION_FORM],
          [FETCH_ALL_TYPES_AT_ONCE]: true,
          [DEPLOY]: {
            [WARN_STALE_DATA]: false,
          },
        }
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithoutWarnStaleData,
          getElemIdFunc: mockGetElemIdFunc,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        adapter.deployModifiers

        expect(getChangeValidatorMock).toHaveBeenCalledWith({
          withSuiteApp: expect.anything(),
          warnStaleData: false,
          fetchByQuery: expect.anything(),
        })
      })

      it('should call getChangeValidator with warnStaleData=true if warnOnStaleWorkspaceData=true in config', async () => {
        const configWithoutWarnStaleData = {
          [TYPES_TO_SKIP]: [SAVED_SEARCH, TRANSACTION_FORM],
          [FETCH_ALL_TYPES_AT_ONCE]: true,
          [DEPLOY]: {
            [WARN_STALE_DATA]: true,
          },
        }
        const adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client),
          elementsSource: buildElementsSourceFromElements([]),
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: configWithoutWarnStaleData,
          getElemIdFunc: mockGetElemIdFunc,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        adapter.deployModifiers

        expect(getChangeValidatorMock).toHaveBeenCalledWith({
          withSuiteApp: expect.anything(),
          warnStaleData: true,
          fetchByQuery: expect.anything(),
        })
      })
    })
  })

  describe('SuiteAppClient', () => {
    const getSystemInformationMock = jest.fn().mockResolvedValue({
      time: new Date(1000),
      appVersion: [0, 1, 0],
    })
    let adapter: NetsuiteAdapter

    const elementsSource = buildElementsSourceFromElements([])
    const getElementMock = jest.spyOn(elementsSource, 'get')
    const getChangedObjectsMock = jest.spyOn(changesDetector, 'getChangedObjects')

    beforeEach(() => {
      getElementMock.mockReset()

      getChangedObjectsMock.mockReset()
      getChangedObjectsMock.mockResolvedValue({
        isTypeMatch: () => true,
        areAllObjectsMatch: () => false,
        isObjectMatch: objectID => objectID.instanceId.startsWith('aa'),
        isFileMatch: () => true,
        areSomeFilesMatch: () => true,
      })

      getSystemInformationMock.mockReset()
      getSystemInformationMock.mockResolvedValue({
        time: new Date(1000),
        appVersion: [0, 1, 0],
      })

      const suiteAppClient = {
        getSystemInformation: getSystemInformationMock,
        getNetsuiteWsdl: () => undefined,
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
      expect(elements.filter(
        e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME)
      )).toHaveLength(0)
    })

    it('should not create serverTime elements when fetchTarget parameter was passed', async () => {
      const suiteAppClient = {
        getSystemInformation: getSystemInformationMock,
        getNetsuiteWsdl: () => undefined,
      } as unknown as SuiteAppClient

      adapter = new NetsuiteAdapter({
        client: new NetsuiteClient(client, suiteAppClient),
        elementsSource,
        filtersCreators: [firstDummyFilter, secondDummyFilter],
        config: {
          ...config,
          [FETCH_TARGET]: {
            types: {},
            filePaths: [],
          },
        },
        getElemIdFunc: mockGetElemIdFunc,
      })

      const { elements } = await adapter.fetch(mockFetchOpts)
      expect(elements.filter(
        e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME)
      )).toHaveLength(0)
    })
    it('should create the serverTime elements when getSystemInformation returns the time', async () => {
      const { elements } = await adapter.fetch(mockFetchOpts)
      expect(elements.filter(
        e => e.elemID.getFullName().includes(SERVER_TIME_TYPE_NAME)
      )).toHaveLength(2)

      const serverTimeInstance = elements.find(
        e => e.elemID.isEqual(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME))
      )
      expect((serverTimeInstance as InstanceElement)?.value?.serverTime)
        .toEqual(new Date(1000).toJSON())
      expect(getChangedObjectsMock).not.toHaveBeenCalled()
    })

    describe('getChangedObjects', () => {
      let suiteAppClient: SuiteAppClient

      beforeEach(() => {
        getElementMock.mockResolvedValue(new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) }),
          {
            serverTime: '1970-01-01T00:00:00.500Z',
          }
        ))

        suiteAppClient = {
          getSystemInformation: getSystemInformationMock,
          getNetsuiteWsdl: () => undefined,
        } as unknown as SuiteAppClient

        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            [FETCH_TARGET]: {
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
        expect(getElementMock).toHaveBeenCalledWith(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME))
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

      it('should pass the received query to the client', async () => {
        const getCustomObjectsMock = jest.spyOn(client, 'getCustomObjects')
        await adapter.fetch(mockFetchOpts)

        const passedQuery = getCustomObjectsMock.mock.calls[0][1]
        expect(passedQuery.isObjectMatch({ instanceId: 'aaaa', type: 'workflow' })).toBeTruthy()
        expect(passedQuery.isObjectMatch({ instanceId: 'bbbb', type: 'workflow' })).toBeFalsy()
      })

      it('should not call getChangedObjectsMock if server time instance is invalid', async () => {
        getElementMock.mockResolvedValue(new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) }),
          {}
        ))
        await adapter.fetch(mockFetchOpts)
        expect(getElementMock).toHaveBeenCalledWith(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME))
        expect(getChangedObjectsMock).not.toHaveBeenCalled()
      })

      it('should not call getChangedObjects if useChangesDetection is false', async () => {
        adapter = new NetsuiteAdapter({
          client: new NetsuiteClient(client, suiteAppClient),
          elementsSource,
          filtersCreators: [firstDummyFilter, secondDummyFilter],
          config: {
            ...config,
            [FETCH_TARGET]: {
              types: {
                workflow: ['.*'],
              },
              filePaths: [],
            },
            [USE_CHANGES_DETECTION]: false,
          },
          getElemIdFunc: mockGetElemIdFunc,
        })

        await adapter.fetch(mockFetchOpts)
        expect(getChangedObjectsMock).not.toHaveBeenCalled()
      })
    })
  })
})
