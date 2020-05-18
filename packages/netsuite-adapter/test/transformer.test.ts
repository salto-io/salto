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
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import { CUSTOM_RECORD_TYPE, ENTITY_CUSTOM_FIELD, SCRIPT_ID } from '../src/constants'
import { customTypes } from '../src/types'
import { convertToCustomizationInfo, convertToXmlContent } from '../src/client/client'

describe('Transformer', () => {
  const XML_TEMPLATES = {
    WITH_LABEL: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>\n',
    WITH_ATTRIBUTE: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>\n',
    WITH_UNKNOWN_ATTRIBUTE: '<entitycustomfield unknownattr="val">\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>\n',
    WITH_TRUE_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <checkspelling>T</checkspelling>\n'
      + '</entitycustomfield>\n',
    WITH_FALSE_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <checkspelling>F</checkspelling>\n'
      + '</entitycustomfield>\n',
    WITH_NUMBER_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <displayheight>123</displayheight>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_PRIMITIVE_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <description></description>\n'
      + '</entitycustomfield>\n',
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
      + '</entitycustomfield>\n',
    WITH_LIST_OF_SINGLE_OBJECT: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '      <accesslevel>1</accesslevel>\n'
      + '      <role>BOOKKEEPER</role>\n'
      + '      <searchlevel>2</searchlevel>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_LIST_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_OBJECT_INNER_FIELDS: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '      <accesslevel></accesslevel>\n'
      + '      <role></role>\n'
      + '      <searchlevel></searchlevel>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_OBJECT_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <roleaccesses>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNKNOWN_FIELD: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '  <unknownfield>unknownVal</unknownfield>\n'
      + '</entitycustomfield>\n',
  }

  describe('createInstanceElement', () => {
    const transformCustomFieldRecord = (xmlContent: string): InstanceElement => {
      const customFieldType = customTypes[ENTITY_CUSTOM_FIELD]
      return createInstanceElement(convertToCustomizationInfo(xmlContent).values, customFieldType)
    }

    it('should create instance name correctly', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LABEL)
      expect(result.elemID.name).toEqual('elementName')
    })

    it('should create instance name correctly when name field is an attribute', () => {
      const savedSearchXmlContent = '<savedsearch scriptid="customsearch_my_search_script_id">\n'
      + '  <definition>BLA</definition>\n'
      + '</savedsearch>\n'
      const savedSearchType = customTypes.savedsearch
      const result = createInstanceElement(convertToCustomizationInfo(savedSearchXmlContent).values,
        savedSearchType)
      expect(result.elemID.name).toEqual('customsearch_my_search_script_id')
    })

    it('should create instance name correctly when name field is undefined', () => {
      const customRecordTypeXmlContent = '<customrecordtype scriptid="customrecord__my_record_script_id">\n'
      + '</customrecordtype>\n'
      const result = createInstanceElement(
        convertToCustomizationInfo(customRecordTypeXmlContent).values,
        customTypes[CUSTOM_RECORD_TYPE]
      )
      expect(result.elemID.name).toEqual('customrecord__my_record_script_id')
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
      expect(result.value.checkspelling).toEqual(true)
    })

    it('should transform boolean primitive field when is false', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_FALSE_FIELD)
      expect(result.value.checkspelling).toEqual(false)
    })

    it('should transform number primitive field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_NUMBER_FIELD)
      expect(result.value.displayheight).toEqual(123)
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
      expect(result.value.roleaccesses.roleaccess).toEqual(
        [{
          accesslevel: '1',
          role: 'BOOKKEEPER',
          searchlevel: '2',
        },
        {
          accesslevel: '0',
          role: 'BUYER',
          searchlevel: '1',
        }]
      )
    })

    it('should transform list field that contains a single object', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LIST_OF_SINGLE_OBJECT)
      expect(result.value.roleaccesses.roleaccess).toEqual(
        [{
          accesslevel: '1',
          role: 'BOOKKEEPER',
          searchlevel: '2',
        }]
      )
    })

    it('should ignore undefined list field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_LIST_FIELD)
      expect(result.value.roleaccesses).toBeUndefined()
    })

    it('should ignore undefined object type field', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_OBJECT_FIELD)
      expect(result.value.roleaccesses).toBeUndefined()
    })

    it('should ignore undefined object type inner fields', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_OBJECT_INNER_FIELDS)
      expect(result.value.roleaccesses).toBeUndefined()
    })

    it('should ignore unknown fields', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_FIELD)
      expect(result.value.unknownfield).toBeUndefined()
    })
  })

  describe('toCustomizationInfo', () => {
    const origInstance = new InstanceElement('elementName',
      customTypes[ENTITY_CUSTOM_FIELD], {
        label: 'elementName',
      })
    let instance: InstanceElement
    beforeEach(() => {
      instance = origInstance.clone()
    })

    it('should transform string primitive field', () => {
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should transform boolean primitive field when is true', () => {
      instance.value.checkspelling = true
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_TRUE_FIELD)
    })

    it('should transform boolean primitive field when is false', () => {
      instance.value.checkspelling = false
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_FALSE_FIELD)
    })

    it('should transform number primitive field', () => {
      instance.value.displayheight = 123
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_NUMBER_FIELD)
    })

    it('should transform attribute field', () => {
      instance.value[SCRIPT_ID] = 'custentity_my_script_id'
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_ATTRIBUTE)
    })

    it('should ignore unknown field', () => {
      instance.value.unknownfield = 'unknownValue'
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should transform list field', () => {
      instance.value.roleaccesses = {
        roleaccess: [{
          accesslevel: '1',
          role: 'BOOKKEEPER',
          searchlevel: '2',
        },
        {
          accesslevel: '0',
          role: 'BUYER',
          searchlevel: '1',
        }],
      }
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LIST_OF_OBJECTS)
    })

    it('should transform empty list field', () => {
      instance.value.roleaccesses = {
        roleaccess: [],
      }
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should transform empty object field', () => {
      instance.value.roleaccesses = {}
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should ignore list field with incompatible type', () => {
      instance.value.roleaccesses = {
        roleaccess: 'not a list',
      }
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })

    it('should ignore object field with incompatible type', () => {
      instance.value.roleaccesses = ['not an object']
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(XML_TEMPLATES.WITH_LABEL)
    })
  })
})
