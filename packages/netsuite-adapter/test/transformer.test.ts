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
import { createInstanceElement, createXmlElement } from '../src/transformer'
import { ENTITY_CUSTOM_FIELD, SCRIPT_ID } from '../src/constants'
import { Types } from '../src/types'
import { convertToSingleXmlElement, convertToXmlString } from '../src/client/client'

describe('Transformer', () => {
  const XML_TEMPLATES = {
    WITH_LABEL: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>',
    WITH_ATTRIBUTE: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>',
    WITH_UNKNOWN_ATTRIBUTE: '<entitycustomfield unknownattr="val">\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>',
    WITH_TRUE_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <checkspelling>T</checkspelling>\n'
      + '</entitycustomfield>',
    WITH_FALSE_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <checkspelling>F</checkspelling>\n'
      + '</entitycustomfield>',
    WITH_NUMBER_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <displayheight>123</displayheight>\n'
      + '</entitycustomfield>',
    WITH_UNDEFINED_PRIMITIVE_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <description></description>\n'
      + '</entitycustomfield>',
    WITH_LIST_OF_OBJECTS: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
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
      + '  </roleaccesses>\n'
      + '</entitycustomfield>',
    WITH_UNDEFINED_LIST_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses></roleaccesses>\n'
      + '</entitycustomfield>',
    WITH_UNDEFINED_OBJECT_INNER_FIELDS: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '      <accesslevel></accesslevel>\n'
      + '      <role></role>\n'
      + '      <searchlevel></searchlevel>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>',
    WITH_UNDEFINED_OBJECT_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess></roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>',
    WITH_UNKNOWN_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <unknownfield>unknownVal</unknownfield>\n'
      + '</entitycustomfield>',
  }

  describe('createInstanceElement', () => {
    const transformCustomFieldRecord = (xmlInput: string): InstanceElement => {
      const customFieldType = Types.customTypes[ENTITY_CUSTOM_FIELD.toLowerCase()]
      return createInstanceElement(convertToSingleXmlElement(xmlInput), customFieldType)
    }

    it('should create instance name correctly', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LABEL)
      expect(result.elemID.name).toEqual('elementName')
    })

    it('should transform attributes', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_ATTRIBUTE)
      expect(result.value[SCRIPT_ID]).toEqual('custentity_my_script_id')
    })

    it('should ignore unknown attribute', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_ATTRIBUTE)
      expect(result.value.unknownattr).toBeUndefined()
    })

    it('should transform boolean primitive field when is true', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_TRUE_FIELD)
      expect(result.value.checkSpelling).toEqual(true)
    })

    it('should transform boolean primitive field when is false', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_FALSE_FIELD)
      expect(result.value.checkSpelling).toEqual(false)
    })

    it('should transform number primitive field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_NUMBER_FIELD)
      expect(result.value.displayHeight).toEqual(123)
    })

    it('should transform string primitive field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LABEL)
      expect(result.value.label).toEqual('elementName')
    })

    it('should ignore undefined primitive field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_PRIMITIVE_FIELD)
      expect(result.value.description).toBeUndefined()
    })

    it('should transform list field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LIST_OF_OBJECTS)
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
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_LIST_FIELD)
      expect(result.value.roleAccesses).toBeUndefined()
    })

    it('should ignore undefined object type field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_OBJECT_FIELD)
      expect(result.value.roleAccesses).toBeUndefined()
    })

    it('should ignore undefined object type inner fields', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_OBJECT_INNER_FIELDS)
      expect(result.value.roleAccesses).toBeUndefined()
    })

    it('should ignore unknown fields', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_FIELD)
      expect(result.value.unknownfield).toBeUndefined()
    })
  })

  describe('createXmlElement', () => {
    const origInstance = new InstanceElement('elementName',
      Types.customTypes[ENTITY_CUSTOM_FIELD.toLowerCase()], {
        label: 'elementName',
      })
    let instance: InstanceElement
    beforeEach(() => {
      instance = origInstance.clone()
    })

    it('should transform string primitive field', () => {
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should transform boolean primitive field when is true', () => {
      instance.value.checkSpelling = true
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_TRUE_FIELD)
    })

    it('should transform boolean primitive field when is false', () => {
      instance.value.checkSpelling = false
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_FALSE_FIELD)
    })

    it('should transform number primitive field', () => {
      instance.value.displayHeight = 123
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_NUMBER_FIELD)
    })

    it('should transform attribute field', () => {
      instance.value[SCRIPT_ID] = 'custentity_my_script_id'
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_ATTRIBUTE)
    })

    it('should ignore unknown field', () => {
      instance.value.unknownField = 'unknownValue'
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should transform list field', () => {
      instance.value.roleAccesses = [{
        accessLevel: '1',
        role: 'BOOKKEEPER',
        searchLevel: '2',
      },
      {
        accessLevel: '0',
        role: 'BUYER',
        searchLevel: '1',
      }]
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LIST_OF_OBJECTS)
    })

    it('should transform empty list field', () => {
      instance.value.roleAccesses = []
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_UNDEFINED_LIST_FIELD)
    })

    it('should transform empty object field', () => {
      instance.value.roleAccesses = [{}]
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_UNDEFINED_OBJECT_FIELD)
    })

    it('should ignore list field with incompatible type', () => {
      instance.value.roleAccesses = 'not an array'
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should ignore object field with incompatible type', () => {
      instance.value.roleAccesses = ['not an object']
      const xmlElement = createXmlElement(instance)
      const xmlContent = convertToXmlString(xmlElement)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_UNDEFINED_LIST_FIELD)
    })
  })
})
