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
  ElemID, InstanceElement, ObjectType, StaticFile, ChangeDataType, DeployResult, getChangeElement,
  ServiceIds,
} from '@salto-io/adapter-api'
import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import { customTypes, fileCabinetTypes, getAllTypes } from '../src/types'
import {
  ENTITY_CUSTOM_FIELD, NETSUITE, SCRIPT_ID, SAVED_SEARCH, FILE, FOLDER, PATH,
} from '../src/constants'
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import {
  convertToCustomizationInfo, FileCustomizationInfo, FolderCustomizationInfo,
} from '../src/client/client'

jest.mock('../src/client/sdf_root_cli_path', () => ({
  getRootCLIPath: jest.fn().mockResolvedValue('path/to/cli'),
}))

const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
  ElemID => new ElemID(adapterName, name)

describe('Adapter', () => {
  const client = createClient()
  const netsuiteAdapter = new NetsuiteAdapter({ client, getElemIdFunc: mockGetElemIdFunc })

  describe('fetch', () => {
    it('should fetch all types and instances', async () => {
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
      const customizationInfo = convertToCustomizationInfo(xmlContent)
      client.importFileCabinet = jest.fn()
        .mockResolvedValue([folderCustomizationInfo, fileCustomizationInfo])
      client.listCustomObjects = jest.fn().mockResolvedValue([customizationInfo])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length + 3)
      const customFieldType = customTypes[ENTITY_CUSTOM_FIELD]
      expect(elements).toContainEqual(customFieldType)
      expect(elements).toContainEqual(
        createInstanceElement(customizationInfo, customFieldType, mockGetElemIdFunc)
      )
      expect(elements).toContainEqual(
        createInstanceElement(fileCustomizationInfo, fileCabinetTypes[FILE], mockGetElemIdFunc)
      )
      expect(elements).toContainEqual(
        createInstanceElement(folderCustomizationInfo, fileCabinetTypes[FOLDER], mockGetElemIdFunc)
      )
    })

    it('should handle exceptions during listCustomObjects', async () => {
      client.importFileCabinet = jest.fn().mockResolvedValue([])
      client.listCustomObjects = jest.fn().mockImplementation(async () => Promise.reject())
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should handle exceptions during importFileCabinet', async () => {
      client.importFileCabinet = jest.fn().mockImplementation(async () => Promise.reject())
      client.listCustomObjects = jest.fn().mockResolvedValue([])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(getAllTypes().length)
    })

    it('should ignore instances of unknown type', async () => {
      const xmlContent = '<unknowntype>\n'
        + '  <label>elementName</label>'
        + '</unknowntype>'
      const customizationInfo = convertToCustomizationInfo(xmlContent)
      client.importFileCabinet = jest.fn().mockResolvedValue([])
      client.listCustomObjects = jest.fn().mockResolvedValue([customizationInfo])
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
  })

  describe('add & update', () => {
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

    beforeEach(() => {
      instance = origInstance.clone()
      client.deployCustomObject = jest.fn().mockImplementation(() => Promise.resolve())
      client.deployFile = jest.fn().mockImplementation(() => Promise.resolve())
      client.deployFolder = jest.fn().mockImplementation(() => Promise.resolve())
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
        expect(client.deployCustomObject).toHaveBeenCalledWith('custentity_my_script_id',
          toCustomizationInfo(expectedResolvedInstance))
        expect(post.isEqual(instance)).toBe(true)
      })

      it('should add file instance', async () => {
        const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
        })
        const result = await adapterAdd(fileInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deployFile).toHaveBeenCalledWith(toCustomizationInfo(fileInstance))
        expect(post.isEqual(fileInstance)).toBe(true)
      })

      it('should add folder instance', async () => {
        const folderInstance = new InstanceElement('folderInstance', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
        })
        const result = await adapterAdd(folderInstance)
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deployFolder).toHaveBeenCalledWith(toCustomizationInfo(folderInstance))
        expect(post.isEqual(folderInstance)).toBe(true)
      })

      it('should fail when trying to add a non custom type or file cabinet instance', async () => {
        const instWithUnsupportedType = new InstanceElement('unsupported',
          new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
        const result = await adapterAdd(instWithUnsupportedType)
        expect(result.appliedChanges).toHaveLength(0)
        expect(result.errors).toHaveLength(1)
      })

      it('should fail when trying to add a typesToSkip instance', async () => {
        const shouldSkipInst = new InstanceElement('skip', customTypes[SAVED_SEARCH])
        const result = await adapterAdd(shouldSkipInst)
        expect(result.appliedChanges).toHaveLength(0)
        expect(result.errors).toHaveLength(1)
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
        expect(client.deployCustomObject).toHaveBeenCalledWith('custentity_my_script_id',
          toCustomizationInfo(expectedResolvedInstance))
        expect(post).toEqual(instance)
      })

      it('should update file instance', async () => {
        const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
        })
        const result = await adapterUpdate(fileInstance, fileInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deployFile).toHaveBeenCalledWith(toCustomizationInfo(fileInstance))
        expect(post).toEqual(fileInstance)
      })

      it('should update folder instance', async () => {
        const folderInstance = new InstanceElement('folderInstance', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
        })
        const result = await adapterUpdate(folderInstance, folderInstance.clone())
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const post = getChangeElement(result.appliedChanges[0]) as InstanceElement
        expect(client.deployFolder).toHaveBeenCalledWith(toCustomizationInfo(folderInstance))
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
        expect(client.deployCustomObject).toHaveBeenCalledWith('custentity_my_script_id',
          toCustomizationInfo(expectedResolvedAfter))
        expect(post).toEqual(after)
      })

      it('should fail if custom type service id has been modified', async () => {
        const after = instance.clone()
        after.value[SCRIPT_ID] = 'modified'
        const result = await adapterUpdate(instance, after)
        expect(result.appliedChanges).toHaveLength(0)
        expect(result.errors).toHaveLength(1)
        expect(client.deployCustomObject).not.toHaveBeenCalled()
      })

      it('should throw an error if file cabinet type service id has been modified', async () => {
        const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
        })
        const after = fileInstance.clone()
        after.value[PATH] = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content2.html'
        const result = await adapterUpdate(fileInstance, after)
        expect(result.appliedChanges).toHaveLength(0)
        expect(result.errors).toHaveLength(1)
        expect(client.deployFile).not.toHaveBeenCalled()
      })

      it('should fail when trying to update a non custom type or file cabinet instance', async () => {
        const instWithUnsupportedType = new InstanceElement('unsupported',
          new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
        const result = await adapterUpdate(instWithUnsupportedType, instWithUnsupportedType.clone())
        expect(result.appliedChanges).toHaveLength(0)
        expect(result.errors).toHaveLength(1)
      })

      it('should throw error when trying to update a typesToSkip instance', async () => {
        const shouldSkipInst = new InstanceElement('skip', customTypes[SAVED_SEARCH])
        const result = await adapterUpdate(shouldSkipInst, shouldSkipInst.clone())
        expect(result.appliedChanges).toHaveLength(0)
        expect(result.errors).toHaveLength(1)
      })
    })
  })
})
