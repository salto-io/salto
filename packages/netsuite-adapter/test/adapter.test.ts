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

import {
  ElemID, InstanceElement, StaticFile, ChangeDataType, DeployResult, getChangeElement,
  ServiceIds, ReferenceExpression, ObjectType, BuiltinTypes,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolveValues } from '@salto-io/adapter-utils'
import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import { customTypes, fileCabinetTypes, getAllTypes } from '../src/types'
import {
  ENTITY_CUSTOM_FIELD, SCRIPT_ID, SAVED_SEARCH, FILE, FOLDER, PATH, TRANSACTION_FORM, TYPES_TO_SKIP,
  FILE_PATHS_REGEX_SKIP_LIST,
} from '../src/constants'
import { createInstanceElement, getLookUpName, toCustomizationInfo } from '../src/transformer'
import {
  convertToCustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo,
} from '../src/client/client'
import { FilterCreator } from '../src/filter'
import { configType, getConfigFromConfigChanges } from '../src/config'

jest.mock('../src/client/sdf_root_cli_path', () => ({
  getRootCLIPath: jest.fn().mockReturnValue('path/to/cli'),
}))

jest.mock('../src/config', () => ({
  ...jest.requireActual('../src/config'),
  getConfigFromConfigChanges: jest.fn(),
}))

const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
  ElemID => new ElemID(adapterName, name)

const onFetchMock = jest.fn().mockImplementation(_arg => undefined)
const firstDummyFilter: FilterCreator = () => ({
  onFetch: onFetchMock(1),
})

const secondDummyFilter: FilterCreator = () => ({
  onFetch: onFetchMock(2),
})

describe('Adapter', () => {
  const filePathRegexStr = '^Some/File/Regex$'
  const client = createClient()
  const config = {
    [TYPES_TO_SKIP]: [TRANSACTION_FORM],
    [FILE_PATHS_REGEX_SKIP_LIST]: [filePathRegexStr],
  }
  const netsuiteAdapter = new NetsuiteAdapter({
    client,
    filtersCreators: [firstDummyFilter, secondDummyFilter],
    config,
    getElemIdFunc: mockGetElemIdFunc,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    client.getCustomObjects = jest.fn().mockResolvedValue({
      elements: [],
      failedTypes: [],
      failedToFetchAllAtOnce: false,
    })
    client.importFileCabinetContent = jest.fn().mockResolvedValue({
      elements: [],
      failedPaths: [],
    })
  })

  describe('fetch', () => {
    it('should fetch all types and instances that are not in skip lists', async () => {
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
        fileContent: 'Dummy content',
      }

      const xmlContent = '<entitycustomfield scriptid="custentity_my_script_id">\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const customTypeInfo = convertToCustomTypeInfo(xmlContent, 'custentity_my_script_id')
      client.importFileCabinetContent = jest.fn()
        .mockResolvedValue({
          elements: [folderCustomizationInfo, fileCustomizationInfo],
          failedPaths: [],
        })
      client.getCustomObjects = jest.fn().mockResolvedValue({
        elements: [customTypeInfo],
        failedTypes: [],
        failedToFetchAllAtOnce: false,
      })
      const { elements } = await netsuiteAdapter.fetch()
      expect(client.getCustomObjects).toHaveBeenCalledWith(
        _.pull(Object.keys(customTypes), SAVED_SEARCH, TRANSACTION_FORM),
        true,
      )
      expect(client.importFileCabinetContent).toHaveBeenCalledWith([new RegExp(filePathRegexStr)])
      expect(elements).toHaveLength(getAllTypes().length + 3)
      const customFieldType = customTypes[ENTITY_CUSTOM_FIELD]
      expect(elements).toContainEqual(customFieldType)
      expect(elements).toContainEqual(
        createInstanceElement(customTypeInfo, customFieldType, mockGetElemIdFunc)
      )
      expect(elements).toContainEqual(
        createInstanceElement(fileCustomizationInfo, fileCabinetTypes[FILE], mockGetElemIdFunc)
      )
      expect(elements).toContainEqual(
        createInstanceElement(folderCustomizationInfo, fileCabinetTypes[FOLDER], mockGetElemIdFunc)
      )
    })

    it('should fail when getCustomObjects fails', async () => {
      client.getCustomObjects = jest.fn().mockImplementation(async () => {
        throw new Error('Dummy error')
      })
      await expect(netsuiteAdapter.fetch()).rejects.toThrow()
    })

    it('should fail when importFileCabinetContent fails', async () => {
      client.importFileCabinetContent = jest.fn().mockImplementation(async () => {
        throw new Error('Dummy error')
      })
      await expect(netsuiteAdapter.fetch()).rejects.toThrow()
    })

    it('should ignore instances of unknown type', async () => {
      const xmlContent = '<unknowntype scriptid="unknown">\n'
        + '  <label>elementName</label>'
        + '</unknowntype>'
      const customTypeInfo = convertToCustomTypeInfo(xmlContent, 'unknown')
      client.getCustomObjects = jest.fn().mockResolvedValue({
        elements: [customTypeInfo],
        failedTypes: [],
        failedToFetchAllAtOnce: false,
      })
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should ignore instances from typesToSkip', async () => {
      const customizationInfo = {
        typeName: SAVED_SEARCH,
        values: {},
      }
      client.getCustomObjects = jest.fn().mockImplementation(async () => ({
        elements: [customizationInfo],
        failedTypes: [],
        failedToFetchAllAtOnce: false,
      }))
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should call filters by their order', async () => {
      await netsuiteAdapter.fetch()
      expect(onFetchMock).toHaveBeenNthCalledWith(1, 1)
      expect(onFetchMock).toHaveBeenNthCalledWith(2, 2)
    })

    it('should call getCustomObjects only with types that are not in typesToSkip', async () => {
      await netsuiteAdapter.fetch()
      expect(client.getCustomObjects)
        .toHaveBeenCalledWith(expect.arrayContaining([ENTITY_CUSTOM_FIELD]), true)
      expect(client.getCustomObjects)
        .not.toHaveBeenCalledWith(expect.arrayContaining([SAVED_SEARCH]), true)
    })

    it('should return only the elements when having no config changes', async () => {
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      getConfigFromConfigChangesMock.mockReturnValue(undefined)
      const fetchResult = await netsuiteAdapter.fetch()
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(false, [], [], config)
      expect(fetchResult.updatedConfig).toBeUndefined()
    })

    it('should call getConfigFromConfigChanges with failed types', async () => {
      client.getCustomObjects = jest.fn().mockResolvedValue({
        elements: [],
        failedTypes: ['TypeA', 'TypeB'],
        failedToFetchAllAtOnce: false,
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue(updatedConfig)
      const fetchResult = await netsuiteAdapter.fetch()
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(false, ['TypeA', 'TypeB'], [], config)
      expect(fetchResult.updatedConfig?.config.isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with failed file paths', async () => {
      client.importFileCabinetContent = jest.fn().mockResolvedValue({
        elements: [],
        failedPaths: ['/path/to/file'],
        failedToFetchAllAtOnce: false,
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue(updatedConfig)
      const fetchResult = await netsuiteAdapter.fetch()
      expect(getConfigFromConfigChanges).toHaveBeenCalledWith(false, [], ['/path/to/file'], config)
      expect(fetchResult.updatedConfig?.config.isEqual(updatedConfig)).toBe(true)
    })

    it('should call getConfigFromConfigChanges with false for fetchAllAtOnce', async () => {
      client.getCustomObjects = jest.fn().mockResolvedValue({
        elements: [],
        failedTypes: [],
        failedToFetchAllAtOnce: true,
      })
      const getConfigFromConfigChangesMock = getConfigFromConfigChanges as jest.Mock
      const updatedConfig = new InstanceElement(ElemID.CONFIG_NAME, configType)
      getConfigFromConfigChangesMock.mockReturnValue(updatedConfig)
      const fetchResult = await netsuiteAdapter.fetch()
      expect(getConfigFromConfigChangesMock).toHaveBeenCalledWith(true, [], [], config)
      expect(fetchResult.updatedConfig?.config.isEqual(updatedConfig)).toBe(true)
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
      groupID: after.elemID.getFullName(),
      changes: [{ action: 'add', data: { after } }],
    })

    describe('add', () => {
      it('should add custom type instance', async () => {
        const result = await adapterAdd(instance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = 'description value'
        expect(client.deploy)
          .toHaveBeenCalledWith([toCustomizationInfo(expectedResolvedInstance)])
        expect(post.isEqual(instance)).toBe(true)
      })

      it('should add file instance', async () => {
        const result = await adapterAdd(fileInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith([toCustomizationInfo(fileInstance)])
        expect(post.isEqual(fileInstance)).toBe(true)
      })

      it('should add folder instance', async () => {
        const result = await adapterAdd(folderInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith([toCustomizationInfo(folderInstance)])
        expect(post.isEqual(folderInstance)).toBe(true)
      })

      it('should support deploying multiple changes at once', async () => {
        const result = await netsuiteAdapter.deploy({
          groupID: 'some group id',
          changes: [
            { action: 'add', data: { after: fileInstance } },
            { action: 'add', data: { after: folderInstance } },
          ],
        })
        expect(client.deploy).toHaveBeenCalledWith(expect.arrayContaining(
          [toCustomizationInfo(folderInstance), toCustomizationInfo(fileInstance)]
        ))
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
      })

      it('should return correct DeployResult in case of failure', async () => {
        const clientError = new Error('some client error')
        client.deploy = jest.fn().mockRejectedValue(clientError)
        const result = await netsuiteAdapter.deploy({
          groupID: 'some group id',
          changes: [
            { action: 'add', data: { after: fileInstance } },
            { action: 'add', data: { after: folderInstance } },
          ],
        })
        expect(client.deploy).toHaveBeenCalledWith(expect.arrayContaining(
          [toCustomizationInfo(folderInstance), toCustomizationInfo(fileInstance)]
        ))
        expect(result.errors).toHaveLength(1)
        expect(result.errors).toEqual([clientError])
        expect(result.appliedChanges).toHaveLength(0)
      })
    })

    describe('update', () => {
      const adapterUpdate = (
        before: ChangeDataType, after: ChangeDataType
      ): Promise<DeployResult> => netsuiteAdapter.deploy({
        groupID: after.elemID.getFullName(),
        changes: [{ action: 'modify', data: { before, after } }],
      })

      it('should update custom type instance', async () => {
        const result = await adapterUpdate(instance, instance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = 'description value'
        expect(client.deploy)
          .toHaveBeenCalledWith([toCustomizationInfo(expectedResolvedInstance)])
        expect(post).toEqual(instance)
      })

      it('should update file instance', async () => {
        const result = await adapterUpdate(fileInstance, fileInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith([toCustomizationInfo(fileInstance)])
        expect(post).toEqual(fileInstance)
      })

      it('should update folder instance', async () => {
        const result = await adapterUpdate(folderInstance, folderInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deploy).toHaveBeenCalledWith([toCustomizationInfo(folderInstance)])
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
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement

        const expectedResolvedAfter = after.clone()
        expectedResolvedAfter.value.description = 'edited description value'
        expect(client.deploy)
          .toHaveBeenCalledWith([toCustomizationInfo(expectedResolvedAfter)])
        expect(post).toEqual(after)
      })
    })

    describe('depending instances', () => {
      const dependsOn1Instance = new InstanceElement('dependsOn1Instance', customTypes[ENTITY_CUSTOM_FIELD], {
        [SCRIPT_ID]: 'custentity_depends_on_1_instance',
        label: new ReferenceExpression(fileInstance.elemID.createNestedID(PATH),
          fileInstance.value[PATH], fileInstance),
      })

      const anotherAdapterInstance = new InstanceElement(
        'anotherAdapterInstance',
        new ObjectType({ elemID: new ElemID('another', 'type'),
          fields: {
            id: { type: BuiltinTypes.SERVICE_ID },
          } }),
        { id: 'serviceIdValue' },
      )

      const instanceWithManyRefs = new InstanceElement('dependsOn2Instances', customTypes[ENTITY_CUSTOM_FIELD], {
        [SCRIPT_ID]: 'custentity_depends_on_2',
        label: new ReferenceExpression(dependsOn1Instance.elemID.createNestedID(SCRIPT_ID),
          dependsOn1Instance.value[SCRIPT_ID], dependsOn1Instance),
        description: new ReferenceExpression(origInstance.elemID.createNestedID('label'),
          origInstance.value.label, origInstance),
        help: new ReferenceExpression(anotherAdapterInstance.elemID.createNestedID('id'),
          anotherAdapterInstance.value.id, anotherAdapterInstance),
      })

      it('should deploy depending', async () => {
        const result = await adapterAdd(instanceWithManyRefs)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(client.deploy).toHaveBeenCalledWith(expect.arrayContaining(
          [toCustomizationInfo(resolveValues(instanceWithManyRefs, getLookUpName)),
            toCustomizationInfo(resolveValues(dependsOn1Instance, getLookUpName)),
            toCustomizationInfo(resolveValues(fileInstance, getLookUpName))]
        ))
        expect(client.deploy).not.toHaveBeenCalledWith(expect.arrayContaining(
          [toCustomizationInfo(resolveValues(origInstance, getLookUpName)),
            toCustomizationInfo(resolveValues(anotherAdapterInstance, getLookUpName))]
        ))
      })
    })
  })
})
