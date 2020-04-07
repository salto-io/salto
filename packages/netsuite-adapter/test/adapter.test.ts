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

import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import { Types } from '../src/types'
import { ENTITY_CUSTOM_FIELD, NETSUITE, SCRIPT_ID } from '../src/constants'
import { createInstanceElement, createXmlElement } from '../src/transformer'
import { convertToSingleXmlElement } from '../src/client/client'

describe('Adapter', () => {
  const client = createClient()
  const netsuiteAdapter = new NetsuiteAdapter({ client })

  describe('fetch', () => {
    it('should fetch all types and instances', async () => {
      const xmlContent = '<entitycustomfield scriptid="custentity_my_script_id">\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const rootXmlElement = convertToSingleXmlElement(xmlContent)
      client.listCustomObjects = jest.fn().mockReturnValue([rootXmlElement])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(Types.getAllTypes().length + 1)
      const customFieldType = Types.customTypes[ENTITY_CUSTOM_FIELD.toLowerCase()]
      expect(elements).toContainEqual(customFieldType)
      expect(elements).toContainEqual(createInstanceElement(rootXmlElement, customFieldType))
    })

    it('should ignore instances of unknown type', async () => {
      const xmlContent = '<unknowntype>\n'
        + '  <label>elementName</label>'
        + '</unknowntype>'
      const rootXmlElement = convertToSingleXmlElement(xmlContent)
      client.listCustomObjects = jest.fn().mockReturnValue([rootXmlElement])
      const { elements } = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(Types.getAllTypes().length)
    })
  })

  describe('add & update', () => {
    const origInstance = new InstanceElement('elementName',
      Types.customTypes[ENTITY_CUSTOM_FIELD.toLowerCase()], {
        label: 'elementName',
        [SCRIPT_ID]: 'custentity_my_script_id',
      })
    let instance: InstanceElement

    beforeEach(() => {
      instance = origInstance.clone()
      client.deploy = jest.fn().mockImplementation(() => Promise.resolve())
    })
    describe('add', () => {
      it('should add instance', async () => {
        const post = await netsuiteAdapter.add(instance)
        expect(client.deploy)
          .toHaveBeenCalledWith('custentity_my_script_id', createXmlElement(instance))
        expect(post).toEqual(instance)
      })

      it('should add default SCRIPT_ID to custom type instance', async () => {
        delete instance.value[SCRIPT_ID]
        const post = await netsuiteAdapter.add(instance)
        expect(post.value[SCRIPT_ID]).toEqual('custentity_elementname')
        expect(client.deploy)
          .toHaveBeenCalledWith('custentity_elementname', createXmlElement(instance))
      })

      it('should throw error when trying to add a non custom type instance', async () => {
        const instWithUnsupportedType = new InstanceElement('unsupported',
          new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
        await expect(netsuiteAdapter.add(instWithUnsupportedType)).rejects.toThrow()
      })
    })

    describe('update', () => {
      it('should update instance', async () => {
        const post = await netsuiteAdapter.update(instance, instance.clone())
        expect(client.deploy)
          .toHaveBeenCalledWith('custentity_my_script_id', createXmlElement(instance))
        expect(post).toEqual(instance)
      })

      it('should throw an error if service id has been modified', async () => {
        const after = instance.clone()
        after.value[SCRIPT_ID] = 'modified'
        await expect(netsuiteAdapter.update(instance, after)).rejects.toThrow()
        expect(client.deploy).not.toHaveBeenCalled()
      })

      it('should throw error when trying to update a non custom type instance', async () => {
        const instWithUnsupportedType = new InstanceElement('unsupported',
          new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
        await expect(
          netsuiteAdapter.update(instWithUnsupportedType, instWithUnsupportedType.clone())
        ).rejects.toThrow()
      })
    })
  })
})
