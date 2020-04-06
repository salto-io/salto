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

import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import { Types } from '../src/types'
import { ENTITY_CUSTOM_FIELD } from '../src/constants'
import { createInstanceElement } from '../src/transformer'
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
})
