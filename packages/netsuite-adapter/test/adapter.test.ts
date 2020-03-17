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
import { InstanceElement } from '@salto-io/adapter-api'
import { Record } from 'node-suitetalk'
import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import {
  ENTITY_CUSTOM_FIELD, INTERNAL_ID, RECORD_REF, SCRIPT_ID,
} from '../src/constants'
import { recordInList, returnedReferenceMock } from './utils'
import { createInstanceElement } from '../src/transformer'
import { Types } from '../src/types'


describe('Adapter', () => {
  const { client } = createClient()
  const netsuiteAdapter = new NetsuiteAdapter({ client })

  describe('fetch', () => {
    it('should fetch all types and instances', async () => {
      client.listCustomizations = jest.fn().mockImplementation(type => {
        if (type === 'entityCustomField') {
          return Promise.resolve([recordInList])
        }
        return Promise.resolve([])
      })
      const elements = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(Types.getAllTypes().length + 1)
      expect(elements).toContainEqual(Types.customizationTypes[ENTITY_CUSTOM_FIELD])
      expect(elements).toContainEqual(createInstanceElement(recordInList,
        Types.customizationTypes[ENTITY_CUSTOM_FIELD]))
    })
  })

  describe('add', () => {
    let result: InstanceElement
    beforeAll(async () => {
      client.add = jest.fn().mockReturnValue(Promise.resolve(returnedReferenceMock))
      const instance = new InstanceElement('test', Types.customizationTypes[ENTITY_CUSTOM_FIELD],
        {
          label: 'Labelo',
          [SCRIPT_ID]: 'my_script_id',
        })
      result = await netsuiteAdapter.add(instance)
    })

    it('should enrich the instance with SCRIPT_ID & INTERNAL_ID post add', () => {
      expect(result.value[INTERNAL_ID]).toEqual('123')
      expect(result.value[SCRIPT_ID]).toEqual('custentity_my_script_id')
    })
  })

  describe('update', () => {
    let beforeInstance: InstanceElement
    beforeAll(async () => {
      client.update = jest.fn().mockReturnValue(Promise.resolve(returnedReferenceMock))
      beforeInstance = new InstanceElement('test',
        Types.customizationTypes[ENTITY_CUSTOM_FIELD], {
          [INTERNAL_ID]: '123',
          [SCRIPT_ID]: 'custentity_my_script_id',
          label: 'Labelo',
        })
    })

    it('should succeed', async () => {
      const afterInstance = beforeInstance.clone()
      afterInstance.value.label = 'Edited'

      const result = await netsuiteAdapter.update(beforeInstance, afterInstance) as InstanceElement

      expect(result.value[INTERNAL_ID]).toEqual('123')
      expect(result.value[SCRIPT_ID]).toEqual('custentity_my_script_id')
      expect(result.value.label).toEqual('Edited')
    })

    it('should throw an error when INTERNAL_ID has changed', async () => {
      const afterInstance = beforeInstance.clone()
      afterInstance.value.label = 'Edited'
      afterInstance.value[INTERNAL_ID] = '456'

      await expect(netsuiteAdapter.update(beforeInstance, afterInstance)).rejects.toThrow()
    })
  })

  describe('remove', () => {
    beforeAll(async () => {
      client.delete = jest.fn().mockImplementation(() => Promise.resolve())
      const instance = new InstanceElement('test', Types.customizationTypes.EntityCustomField, {
        [INTERNAL_ID]: '123',
      })
      await netsuiteAdapter.remove(instance)
    })

    it('should call client.delete with the correct parameter', () => {
      const recordRef = new Record.Types.Reference(RECORD_REF, 'entityCustomField', '123')
      expect(client.delete).toHaveBeenCalledWith(recordRef)
    })
  })
})
