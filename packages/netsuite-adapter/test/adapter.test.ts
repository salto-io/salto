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

import { ElemID, InstanceElement, ObjectType, StaticFile } from '@salto-io/adapter-api'
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

describe('Adapter', () => {
  const client = createClient()
  const netsuiteAdapter = new NetsuiteAdapter({ client })

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
      expect(elements)
        .toContainEqual(createInstanceElement(customizationInfo, customFieldType))
      expect(elements)
        .toContainEqual(createInstanceElement(fileCustomizationInfo, fileCabinetTypes[FILE]))
      expect(elements)
        .toContainEqual(createInstanceElement(folderCustomizationInfo, fileCabinetTypes[FOLDER]))
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
      it('should add custom type instance', async () => {
        const post = await netsuiteAdapter.add(instance)

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
        const post = await netsuiteAdapter.add(fileInstance)
        expect(client.deployFile).toHaveBeenCalledWith(toCustomizationInfo(fileInstance))
        expect(post.isEqual(fileInstance)).toBe(true)
      })

      it('should add folder instance', async () => {
        const folderInstance = new InstanceElement('folderInstance', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
        })
        const post = await netsuiteAdapter.add(folderInstance)
        expect(client.deployFolder).toHaveBeenCalledWith(toCustomizationInfo(folderInstance))
        expect(post.isEqual(folderInstance)).toBe(true)
      })

      it('should add default SCRIPT_ID to custom type instance', async () => {
        delete instance.value[SCRIPT_ID]
        const post = await netsuiteAdapter.add(instance)

        const expectedResolvedInstance = instance.clone()
        expectedResolvedInstance.value.description = 'description value'
        expectedResolvedInstance.value[SCRIPT_ID] = 'custentity_elementname'
        expect(post.value[SCRIPT_ID]).toEqual('custentity_elementname')
        expect(client.deployCustomObject).toHaveBeenCalledWith('custentity_elementname',
          toCustomizationInfo(expectedResolvedInstance))
      })

      it('should throw error when trying to add a non custom type or file cabinet instance', async () => {
        const instWithUnsupportedType = new InstanceElement('unsupported',
          new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
        await expect(netsuiteAdapter.add(instWithUnsupportedType)).rejects.toThrow()
      })

      it('should throw error when trying to add a typesToSkip instance', async () => {
        const shouldSkipInst = new InstanceElement('skip', customTypes[SAVED_SEARCH])
        await expect(netsuiteAdapter.add(shouldSkipInst)).rejects.toThrow()
      })
    })

    describe('update', () => {
      it('should update custom type instance', async () => {
        const post = await netsuiteAdapter.update(instance, instance.clone())

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
        const post = await netsuiteAdapter.update(fileInstance, fileInstance.clone())
        expect(client.deployFile).toHaveBeenCalledWith(toCustomizationInfo(fileInstance))
        expect(post).toEqual(fileInstance)
      })

      it('should update folder instance', async () => {
        const folderInstance = new InstanceElement('folderInstance', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
        })
        const post = await netsuiteAdapter.update(folderInstance, folderInstance.clone())
        expect(client.deployFolder).toHaveBeenCalledWith(toCustomizationInfo(folderInstance))
        expect(post).toEqual(folderInstance)
      })

      it('should restore static file', async () => {
        const after = instance.clone()
        after.value.description = new StaticFile({
          filepath: 'netsuite/elementName.suffix',
          content: Buffer.from('edited description value'),
        })
        const post = await netsuiteAdapter.update(instance, after)

        const expectedResolvedAfter = after.clone()
        expectedResolvedAfter.value.description = 'edited description value'
        expect(client.deployCustomObject).toHaveBeenCalledWith('custentity_my_script_id',
          toCustomizationInfo(expectedResolvedAfter))
        expect(post).toEqual(after)
      })

      it('should throw an error if custom type service id has been modified', async () => {
        const after = instance.clone()
        after.value[SCRIPT_ID] = 'modified'
        await expect(netsuiteAdapter.update(instance, after)).rejects.toThrow()
        expect(client.deployCustomObject).not.toHaveBeenCalled()
      })

      it('should throw an error if file cabinet type service id has been modified', async () => {
        const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
        })
        const after = fileInstance.clone()
        after.value[PATH] = 'Templates/E-mail Templates/Inner EmailTemplates Folder/content2.html'
        await expect(netsuiteAdapter.update(fileInstance, after)).rejects.toThrow()
        expect(client.deployFile).not.toHaveBeenCalled()
      })

      it('should throw error when trying to update a non custom type or file cabinet instance', async () => {
        const instWithUnsupportedType = new InstanceElement('unsupported',
          new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
        await expect(
          netsuiteAdapter.update(instWithUnsupportedType, instWithUnsupportedType.clone())
        ).rejects.toThrow()
      })

      it('should throw error when trying to update a typesToSkip instance', async () => {
        const shouldSkipInst = new InstanceElement('skip', customTypes[SAVED_SEARCH])
        await expect(netsuiteAdapter.update(shouldSkipInst, shouldSkipInst.clone()))
          .rejects.toThrow()
      })
    })
  })
})
