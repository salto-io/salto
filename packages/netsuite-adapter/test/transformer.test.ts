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
import { InstanceElement, StaticFile } from '@salto-io/adapter-api'
import { createInstanceElement, toCustomizationInfo } from '../src/transformer'
import {
  ADDRESS_FORM, CUSTOM_RECORD_TYPE, ENTITY_CUSTOM_FIELD, SCRIPT_ID, TRANSACTION_FORM,
  EMAIL_TEMPLATE, NETSUITE, RECORDS_PATH, FILE, FILE_CABINET_PATH, FOLDER, PATH,
} from '../src/constants'
import { customTypes, fileCabinetTypes } from '../src/types'
import {
  convertToCustomizationInfo,
  convertToXmlContent,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  isFileCustomizationInfo,
  isFolderCustomizationInfo,
} from '../src/client/client'

const removeLineBreaks = (xmlContent: string): string => xmlContent.replace(/\n\s*/g, '')

describe('Transformer', () => {
  const XML_TEMPLATES = {
    WITH_LABEL: '<entitycustomfield>\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>\n',
    WITH_ATTRIBUTE: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>\n',
    WITH_NESTED_ATTRIBUTE: '<customrecordtype scriptid="customrecord_my_script_id">\n'
      + '  <customrecordcustomfields>\n'
      + '    <customrecordcustomfield scriptid="custrecord_my_nested_script_id">\n'
      + '    </customrecordcustomfield>\n'
      + '  </customrecordcustomfields>\n'
      + '</customrecordtype>\n',
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
      return createInstanceElement(convertToCustomizationInfo(xmlContent), customFieldType)
    }

    it('should create instance name correctly', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LABEL)
      expect(result.elemID.name).toEqual('elementName')
    })

    it('should create instance path correctly for custom type instance', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_LABEL)
      expect(result.path).toEqual([NETSUITE, RECORDS_PATH, ENTITY_CUSTOM_FIELD, 'elementName'])
    })

    it('should create instance name correctly when name field is an attribute', () => {
      const savedSearchXmlContent = '<savedsearch scriptid="customsearch_my_search_script_id">\n'
      + '  <definition>BLA</definition>\n'
      + '</savedsearch>\n'
      const savedSearchType = customTypes.savedsearch
      const result = createInstanceElement(convertToCustomizationInfo(savedSearchXmlContent),
        savedSearchType)
      expect(result.elemID.name).toEqual('customsearch_my_search_script_id')
    })

    it('should create instance name correctly when name field is undefined', () => {
      const customRecordTypeXmlContent = '<customrecordtype scriptid="customrecord__my_record_script_id">\n'
      + '</customrecordtype>\n'
      const result = createInstanceElement(
        convertToCustomizationInfo(customRecordTypeXmlContent),
        customTypes[CUSTOM_RECORD_TYPE]
      )
      expect(result.elemID.name).toEqual('customrecord__my_record_script_id')
    })

    it('should transform attributes', () => {
      const result = transformCustomFieldRecord(XML_TEMPLATES.WITH_ATTRIBUTE)
      expect(result.value[SCRIPT_ID]).toEqual('custentity_my_script_id')
    })

    it('should transform nested attributes', () => {
      const customRecordTypeXmlContent = XML_TEMPLATES.WITH_NESTED_ATTRIBUTE
      const result = createInstanceElement(
        convertToCustomizationInfo(customRecordTypeXmlContent),
        customTypes[CUSTOM_RECORD_TYPE]
      )
      expect(result.value[SCRIPT_ID]).toEqual('customrecord_my_script_id')
      const { customrecordcustomfields } = result.value
      expect(customrecordcustomfields).toBeDefined()
      const { customrecordcustomfield } = customrecordcustomfields
      expect(customrecordcustomfield).toHaveLength(1)
      expect(customrecordcustomfield[0][SCRIPT_ID]).toEqual('custrecord_my_nested_script_id')
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

    it('should add content value with additionalFile content as static file', () => {
      const emailTemplateContent = 'Email template content'
      const emailTemplateCustomizationInfo = {
        typeName: EMAIL_TEMPLATE,
        values: {
          name: 'email template name',
          [SCRIPT_ID]: 'custemailtmpl_my_script_id',
        },
        additionalFileContent: emailTemplateContent,
        additionalFileExtension: 'html',
      }
      const result = createInstanceElement(
        emailTemplateCustomizationInfo,
        customTypes[EMAIL_TEMPLATE]
      )
      expect(result.value).toEqual({
        name: 'email template name',
        [SCRIPT_ID]: 'custemailtmpl_my_script_id',
        content: new StaticFile({
          filepath: 'netsuite/emailtemplate/email_template_name.html',
          content: Buffer.from(emailTemplateContent),
        }),
      })
    })

    it('should not add content value when there is no additionalFile', () => {
      const emailTemplateCustomizationInfo = {
        typeName: EMAIL_TEMPLATE,
        values: {
          name: 'email template name',
          [SCRIPT_ID]: 'custemailtmpl_my_script_id',
        },
      }
      const result = createInstanceElement(
        emailTemplateCustomizationInfo,
        customTypes[EMAIL_TEMPLATE]
      )
      expect(result.value).toEqual({
        name: 'email template name',
        [SCRIPT_ID]: 'custemailtmpl_my_script_id',
      })
    })

    describe('file cabinet types', () => {
      const fileCustomizationInfo: FileCustomizationInfo = {
        typeName: FILE,
        values: {
          description: 'file description',
        },
        path: ['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder', 'content.html'],
        fileContent: 'dummy file content',
      }

      const folderCustomizationInfo: FolderCustomizationInfo = {
        typeName: FOLDER,
        values: {
          description: 'folder description',
        },
        path: ['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder'],
      }

      it('should create instance path correctly for file instance', () => {
        const result = createInstanceElement(fileCustomizationInfo, fileCabinetTypes[FILE])
        expect(result.path)
          .toEqual([NETSUITE, FILE_CABINET_PATH, 'Templates', 'E-mail Templates',
            'Inner EmailTemplates Folder', 'content.html'])
      })

      it('should create instance path correctly for folder instance', () => {
        const result = createInstanceElement(folderCustomizationInfo, fileCabinetTypes[FOLDER])
        expect(result.path)
          .toEqual([NETSUITE, FILE_CABINET_PATH, 'Templates', 'E-mail Templates',
            'Inner EmailTemplates Folder'])
      })

      it('should transform path field correctly', () => {
        const result = createInstanceElement(fileCustomizationInfo, fileCabinetTypes[FILE])
        expect(result.value[PATH])
          .toEqual('Templates/E-mail Templates/Inner EmailTemplates Folder/content.html')
      })

      it('should set file content in the content field for file instance', () => {
        const result = createInstanceElement(fileCustomizationInfo, fileCabinetTypes[FILE])
        expect(result.value.content).toEqual(new StaticFile({
          filepath: `${NETSUITE}/${FILE_CABINET_PATH}/Templates/E-mail Templates/Inner EmailTemplates Folder/content.html`,
          content: Buffer.from('dummy file content'),
        }))
      })
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
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LABEL))
    })

    it('should transform boolean primitive field when is true', () => {
      instance.value.checkspelling = true
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_TRUE_FIELD))
    })

    it('should transform boolean primitive field when is false', () => {
      instance.value.checkspelling = false
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_FALSE_FIELD))
    })

    it('should transform number primitive field', () => {
      instance.value.displayheight = 123
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_NUMBER_FIELD))
    })

    it('should transform cdata primitive field', () => {
      const addressFormInstance = new InstanceElement('elementName',
        customTypes[ADDRESS_FORM], {
          name: 'elementName',
          addressTemplate: '<myCdata><field>whoohoo',
        })
      const customizationInfo = toCustomizationInfo(addressFormInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks('<addressForm>\n'
        + '  <name>elementName</name>\n'
        + '  <addressTemplate><![CDATA[<myCdata><field>whoohoo]]></addressTemplate>\n'
        + '</addressForm>\n'))
    })

    it('should transform when cdata primitive field is undefined', () => {
      const addressFormInstance = new InstanceElement('elementName',
        customTypes[ADDRESS_FORM], {
          name: 'elementName',
        })
      const customizationInfo = toCustomizationInfo(addressFormInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks('<addressForm>\n'
        + '  <name>elementName</name>\n'
        + '</addressForm>\n'))
    })

    it('should transform attribute field', () => {
      instance.value[SCRIPT_ID] = 'custentity_my_script_id'
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_ATTRIBUTE))
    })

    it('should transform nested attribute field', () => {
      const customRecordTypeInstance = new InstanceElement('elementName',
        customTypes[CUSTOM_RECORD_TYPE], {
          [SCRIPT_ID]: 'customrecord_my_script_id',
          customrecordcustomfields: {
            customrecordcustomfield: [{
              [SCRIPT_ID]: 'custrecord_my_nested_script_id',
            }],
          },
        })
      const customizationInfo = toCustomizationInfo(customRecordTypeInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_NESTED_ATTRIBUTE))
    })

    it('should ignore unknown field', () => {
      instance.value.unknownfield = 'unknownValue'
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LABEL))
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
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LIST_OF_OBJECTS))
    })

    it('should transform empty list field', () => {
      instance.value.roleaccesses = {
        roleaccess: [],
      }
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LABEL))
    })

    it('should transform empty object field', () => {
      instance.value.roleaccesses = {}
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LABEL))
    })

    it('should ignore list field with incompatible type', () => {
      instance.value.roleaccesses = {
        roleaccess: 'not a list',
      }
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LABEL))
    })

    it('should ignore object field with incompatible type', () => {
      instance.value.roleaccesses = ['not an object']
      const customizationInfo = toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LABEL))
    })

    it('should transform ordered values for forms', () => {
      const transactionFormInstance = new InstanceElement('elementName',
        customTypes[TRANSACTION_FORM], {
          address: 'my address',
          mainFields: {
            defaultFieldGroup: {
              fields: {
                field: [{
                  label: 'My Default Label',
                  visible: true,
                  id: 'my_default_id',
                }],
                position: 'TOP',
              },
            },
            fieldGroup: {
              fields: {
                field: [{
                  label: 'My Label',
                  visible: true,
                  id: 'my_id',
                }],
                position: 'MIDDLE',
              },
            },
          },
          name: 'Form Name',
          standard: 'STANDARDESTIMATE',
          [SCRIPT_ID]: 'custform_my_script_id',
        })

      const customizationInfo = toCustomizationInfo(transactionFormInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks('<transactionForm scriptid="custform_my_script_id" standard="STANDARDESTIMATE">\n'
        + '  <name>Form Name</name>\n'
        + '  <mainFields>\n'
        + '   <fieldGroup>\n'
        + '     <fields position="MIDDLE">\n'
        + '       <field>\n'
        + '         <id>my_id</id>\n'
        + '         <label>My Label</label>\n'
        + '         <visible>T</visible>\n'
        + '       </field>\n'
        + '     </fields>\n'
        + '   </fieldGroup>\n'
        + '   <defaultFieldGroup>\n'
        + '     <fields position="TOP">\n'
        + '       <field>\n'
        + '         <id>my_default_id</id>\n'
        + '         <label>My Default Label</label>\n'
        + '         <visible>T</visible>\n'
        + '       </field>\n'
        + '     </fields>\n'
        + '   </defaultFieldGroup>\n'
        + '  </mainFields>\n'
        + '  <address>my address</address>\n'
        + '</transactionForm>\n'))
    })

    it('should transform additionalFile content', () => {
      const emailTemplateContent = 'email template content'
      const elementName = 'elementName'
      const emailTemplateInstance = new InstanceElement(elementName,
        customTypes[EMAIL_TEMPLATE], {
          name: elementName,
          content: emailTemplateContent,
        })
      const customizationInfo = toCustomizationInfo(emailTemplateInstance)
      expect(customizationInfo).toEqual({
        typeName: EMAIL_TEMPLATE,
        values: {
          name: elementName,
        },
        additionalFileContent: emailTemplateContent,
        additionalFileExtension: 'html',
      })
    })

    it('should not transform additionalFile content when content is undefined', () => {
      const elementName = 'elementName'
      const emailTemplateInstance = new InstanceElement(elementName,
        customTypes[EMAIL_TEMPLATE], {
          name: elementName,
        })
      const customizationInfo = toCustomizationInfo(emailTemplateInstance)
      expect(customizationInfo).toEqual({
        typeName: EMAIL_TEMPLATE,
        values: {
          name: elementName,
        },
      })
    })

    describe('file cabinet types', () => {
      it('should transform file instance', () => {
        const fileInstance = new InstanceElement('elementName', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
          content: 'dummy file content',
          description: 'file description',
        })
        const customizationInfo = toCustomizationInfo(fileInstance)
        expect(isFileCustomizationInfo(customizationInfo)).toBe(true)
        const fileCustomizationInfo = customizationInfo as FileCustomizationInfo
        expect(fileCustomizationInfo.typeName).toEqual(FILE)
        expect(fileCustomizationInfo.values).toEqual({ description: 'file description' })
        expect(fileCustomizationInfo.path)
          .toEqual(['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder', 'content.html'])
        expect(fileCustomizationInfo.fileContent).toEqual('dummy file content')
      })

      it('should transform folder instance', () => {
        const folder = new InstanceElement('elementName', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
          description: 'folder description',
        })
        const customizationInfo = toCustomizationInfo(folder)
        expect(isFolderCustomizationInfo(customizationInfo)).toBe(true)
        const folderCustomizationInfo = customizationInfo as FolderCustomizationInfo
        expect(folderCustomizationInfo.typeName).toEqual(FOLDER)
        expect(folderCustomizationInfo.values).toEqual({ description: 'folder description' })
        expect(folderCustomizationInfo.path)
          .toEqual(['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder'])
      })
    })
  })
})
