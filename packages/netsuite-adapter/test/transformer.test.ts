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
import { createInstanceElement } from '../src/transformer'
import { ENTITY_CUSTOM_FIELD, SCRIPT_ID } from '../src/constants'
import { Types } from '../src/types'
import { convertToSingleXmlElement } from '../src/client/client'

describe('Transformer', () => {
  describe('createInstanceElement', () => {
    const transformCustomFieldRecord = (xmlInput: string): InstanceElement => {
      const customFieldType = Types.customTypes[ENTITY_CUSTOM_FIELD.toLowerCase()]
      return createInstanceElement(convertToSingleXmlElement(xmlInput), customFieldType)
    }

    it('should create instance name correctly', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.elemID.name).toEqual('elementName')
    })

    it('should transform attributes', () => {
      const xmlInput = '<entitycustomfield scriptid="custentity_my_script_id">\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value[SCRIPT_ID]).toEqual('custentity_my_script_id')
    })

    it('should ignore unknown attribute', () => {
      const xmlInput = '<entitycustomfield unknownattr="val">\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.unknownattr).toBeUndefined()
    })

    it('should transform boolean primitive field when is true', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <checkspelling>T</checkspelling>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.checkSpelling).toEqual(true)
    })

    it('should transform boolean primitive field when is false', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <checkspelling>F</checkspelling>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.checkSpelling).toEqual(false)
    })

    it('should transform number primitive field', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <displayheight>123</displayheight>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.displayHeight).toEqual(123)
    })

    it('should transform string primitive field', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.label).toEqual('elementName')
    })

    it('should ignore undefined primitive field', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <description></description>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.description).toBeUndefined()
    })

    it('should transform list field', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <roleaccesses>\n'
        + '    <roleaccess>\n'
        + '      <accesslevel>1</accesslevel>\n'
        + '      <role>BOOKKEEPER</role>\n'
        + '      <searchlevel>2</searchlevel>\n'
        + '    </roleaccess>\n'
        + '    <roleaccess>\n'
        + '      <accesslevel>0</accesslevel>\n'
        + '      <role>BUYER</role>\n'
        + '      <searchlevel>1</searchlevel>\n'
        + '    </roleaccess>\n'
        + '  </roleaccesses>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.roleAccesses).toEqual(
        [{
          accessLevel: '1',
          role: 'BOOKKEEPER',
          searchLevel: '2',
        },
        {
          accessLevel: '0',
          role: 'BUYER',
          searchLevel: '1',
        }]
      )
    })

    it('should ignore undefined list field', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <roleaccesses></roleaccesses>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.roleAccesses).toBeUndefined()
    })

    it('should ignore undefined object type field', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <roleaccesses>'
        + '    <roleaccess>\n'
        + '      <accesslevel></accesslevel>\n'
        + '      <role></role>\n'
        + '      <searchlevel></searchlevel>\n'
        + '    </roleaccess>\n'
        + '    <roleaccess></roleaccess>'
        + '  </roleaccesses>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.roleAccesses).toBeUndefined()
    })

    it('should ignore unknown fields', () => {
      const xmlInput = '<entitycustomfield>\n'
        + '  <label>elementName</label>'
        + '  <unknownfield></unknownfield>'
        + '</entitycustomfield>'
      const result = transformCustomFieldRecord(xmlInput)
      expect(result.value.unknownfield).toBeUndefined()
    })
  })
})
