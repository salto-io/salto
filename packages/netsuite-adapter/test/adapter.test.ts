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
  ElemID, InstanceElement, StaticFile, ChangeDataType, DeployResult, getChangeElement, ServiceIds,
} from '@salto-io/adapter-api'
import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import { customTypes, fileCabinetTypes, getAllTypes } from '../src/types'
import {
  ENTITY_CUSTOM_FIELD, SCRIPT_ID, SAVED_SEARCH, FILE, FOLDER, PATH, TRANSACTION_FORM, TYPES_TO_SKIP,
} from '../src/constants'
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import {
  convertToCustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo,
} from '../src/client/client'
import { FilterCreator } from '../src/filter'

jest.mock('../src/client/sdf_root_cli_path', () => ({
  getRootCLIPath: jest.fn().mockResolvedValue('path/to/cli'),
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
  const client = createClient()
  const netsuiteAdapter = new NetsuiteAdapter({
    client,
    filtersCreators: [firstDummyFilter, secondDummyFilter],
    config: { [TYPES_TO_SKIP]: [TRANSACTION_FORM] },
    getElemIdFunc: mockGetElemIdFunc,
  })

  describe('fetch', () => {
    it('should fetch all types and instances that are not in typesToSkip', async () => {
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
        .mockResolvedValue([folderCustomizationInfo, fileCustomizationInfo])
      client.listCustomObjects = jest.fn().mockResolvedValue([customTypeInfo])
      const { elements } = await netsuiteAdapter.fetch()
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

    it('should handle exceptions during listCustomObjects', async () => {
      client.importFileCabinetContent = jest.fn().mockResolvedValue([])
      client.listCustomObjects = jest.fn().mockImplementation(async () => Promise.reject())
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should handle exceptions during importFileCabinetContent', async () => {
      client.importFileCabinetContent = jest.fn().mockImplementation(async () => Promise.reject())
      client.listCustomObjects = jest.fn().mockResolvedValue([])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should ignore instances of unknown type', async () => {
      const xmlContent = '<unknowntype scriptid="unknown">\n'
        + '  <label>elementName</label>'
        + '</unknowntype>'
      const customTypeInfo = convertToCustomTypeInfo(xmlContent, 'unknown')
      client.importFileCabinetContent = jest.fn().mockResolvedValue([])
      client.listCustomObjects = jest.fn().mockResolvedValue([customTypeInfo])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should ignore instances from typesToSkip', async () => {
      const customizationInfo = {
        typeName: SAVED_SEARCH,
        values: {},
      }
      client.listCustomObjects = jest.fn().mockImplementation(async () => [customizationInfo])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should call filters by their order', async () => {
      await netsuiteAdapter.fetch()
      expect(onFetchMock).toHaveBeenNthCalledWith(1, 1)
      expect(onFetchMock).toHaveBeenNthCalledWith(2, 2)
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
    describe('add', () => {
      const adapterAdd = (after: ChangeDataType): Promise<DeployResult> => netsuiteAdapter.deploy({
        groupID: after.elemID.getFullName(),
        changes: [{ action: 'add', data: { after } }],
      })

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
  })
})
