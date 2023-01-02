/*
*                      Copyright 2022 Salto Labs Ltd.
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
  BuiltinTypes,
  ElemID, InstanceElement, ObjectType, ReferenceExpression, ServiceIds, StaticFile,
} from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { createInstanceElement, getLookUpName, toCustomizationInfo } from '../src/transformer'
import {
  ENTITY_CUSTOM_FIELD, SCRIPT_ID, CUSTOM_RECORD_TYPE, METADATA_TYPE,
  EMAIL_TEMPLATE, NETSUITE, RECORDS_PATH, FILE, FILE_CABINET_PATH, FOLDER, PATH, CONFIG_FEATURES,
} from '../src/constants'
import { convertToCustomTypeInfo, convertToXmlContent } from '../src/client/sdf_client'
import { CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo, TemplateCustomTypeInfo } from '../src/client/types'
import { isFileCustomizationInfo, isFolderCustomizationInfo } from '../src/client/utils'
import { entitycustomfieldType } from '../src/autogen/types/standard_types/entitycustomfield'
import { getFileCabinetTypes } from '../src/types/file_cabinet_types'
import { featuresType } from '../src/types/configuration_types'
import { customrecordtypeType } from '../src/autogen/types/standard_types/customrecordtype'
import { emailtemplateType } from '../src/autogen/types/standard_types/emailtemplate'
import { addressFormType } from '../src/autogen/types/standard_types/addressForm'
import { transactionFormType } from '../src/autogen/types/standard_types/transactionForm'
import { workflowType } from '../src/autogen/types/standard_types/workflow'

const removeLineBreaks = (xmlContent: string): string => xmlContent.replace(/\n\s*/g, '')

const NAME_FROM_GET_ELEM_ID = 'nameFromGetElemId'
const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
  ElemID => new ElemID(adapterName, `${NAME_FROM_GET_ELEM_ID}${name}`)

describe('Transformer', () => {
  const XML_TEMPLATES = {
    WITH_SCRIPT_ID: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '</entitycustomfield>\n',
    WITH_NESTED_ATTRIBUTE: '<customrecordtype scriptid="customrecord_my_script_id">\n'
      + '  <customrecordcustomfields>\n'
      + '    <customrecordcustomfield scriptid="custrecord_my_nested_script_id">\n'
      + '    </customrecordcustomfield>\n'
      + '  </customrecordcustomfields>\n'
      + '</customrecordtype>\n',
    WITH_UNKNOWN_ATTRIBUTE: '<entitycustomfield scriptid="custentity_my_script_id" unknownattr="val">\n'
      + '</entitycustomfield>\n',
    WITH_STRING_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <label>elementName</label>\n'
      + '</entitycustomfield>\n',
    WITH_TRUE_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <checkspelling>T</checkspelling>\n'
      + '</entitycustomfield>\n',
    WITH_UNKNOWN_TRUE_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <unknownattr>T</unknownattr>\n'
      + '</entitycustomfield>\n',
    WITH_FALSE_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <checkspelling>F</checkspelling>\n'
      + '</entitycustomfield>\n',
    WITH_UNKNOWN_FALSE_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <unknownattr>F</unknownattr>\n'
      + '</entitycustomfield>\n',
    WITH_NUMBER_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <displayheight>123</displayheight>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_PRIMITIVE_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <description></description>\n'
      + '</entitycustomfield>\n',
    WITH_LIST_OF_OBJECTS: '<entitycustomfield scriptid="custentity_my_script_id">\n'
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
    WITH_LIST_OF_SINGLE_OBJECT: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '      <accesslevel>1</accesslevel>\n'
      + '      <role>BOOKKEEPER</role>\n'
      + '      <searchlevel>2</searchlevel>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_LIST_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_OBJECT_INNER_FIELDS: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <roleaccesses>\n'
      + '    <roleaccess>\n'
      + '      <accesslevel></accesslevel>\n'
      + '      <role></role>\n'
      + '      <searchlevel></searchlevel>\n'
      + '    </roleaccess>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNDEFINED_OBJECT_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <roleaccesses>\n'
      + '  </roleaccesses>\n'
      + '</entitycustomfield>\n',
    WITH_UNKNOWN_FIELD: '<entitycustomfield scriptid="custentity_my_script_id">\n'
      + '  <unknownfield>unknownVal</unknownfield>\n'
      + '</entitycustomfield>\n',
    WITH_HTML_CHARS: '<entitycustomfield scriptid="custentity_my_script_id">\n'
    + '  <label>Golf &#x26; Co&#x2019;Co element&#x200B;Name</label>\n'
    + '</entitycustomfield>\n',
  }

  const entitycustomfield = entitycustomfieldType().type
  const customrecordtype = customrecordtypeType().type
  const emailtemplate = emailtemplateType().type
  const addressForm = addressFormType().type
  const transactionForm = transactionFormType().type
  const workflow = workflowType().type
  const { file, folder } = getFileCabinetTypes()
  const companyFeatures = featuresType()

  describe('createInstanceElement', () => {
    const transformCustomFieldRecord = (xmlContent: string): Promise<InstanceElement> => {
      const customFieldType = entitycustomfield
      return createInstanceElement(
        convertToCustomTypeInfo(xmlContent, 'custentity_my_script_id'),
        customFieldType,
        mockGetElemIdFunc
      )
    }

    it('should create instance name correctly', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_SCRIPT_ID)
      expect(result.elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}custentity_my_script_id`)
    })

    it('should create instance path correctly for custom type instance', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_SCRIPT_ID)
      expect(result.path).toEqual([NETSUITE, RECORDS_PATH, ENTITY_CUSTOM_FIELD, result.elemID.name])
    })

    it('should transform attributes', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_SCRIPT_ID)
      expect(result.value[SCRIPT_ID]).toEqual('custentity_my_script_id')
    })

    it('should transform nested attributes', async () => {
      const customRecordTypeXmlContent = XML_TEMPLATES.WITH_NESTED_ATTRIBUTE
      const result = await createInstanceElement(
        convertToCustomTypeInfo(customRecordTypeXmlContent, 'customrecord_my_script_id'),
        customrecordtype,
        mockGetElemIdFunc
      )
      expect(result.value[SCRIPT_ID]).toEqual('customrecord_my_script_id')
      const { customrecordcustomfields } = result.value
      expect(customrecordcustomfields).toBeDefined()
      const { customrecordcustomfield } = customrecordcustomfields
      expect(customrecordcustomfield[SCRIPT_ID]).toEqual('custrecord_my_nested_script_id')
    })

    it('should not ignore unknown attribute', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_ATTRIBUTE)
      expect(result.value.unknownattr).toBeDefined()
    })

    it('should transform boolean primitive field when is true', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_TRUE_FIELD)
      expect(result.value.checkspelling).toEqual(true)
    })

    it('should transform boolean primitive field when is true even if field is unknown', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_TRUE_FIELD)
      expect(result.value.unknownattr).toEqual(true)
    })

    it('should transform boolean primitive field when is false', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_FALSE_FIELD)
      expect(result.value.checkspelling).toEqual(false)
    })

    it('should transform boolean primitive field when is false even if field is unknown', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_FALSE_FIELD)
      expect(result.value.unknownattr).toEqual(false)
    })

    it('should transform number primitive field', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_NUMBER_FIELD)
      expect(result.value.displayheight).toEqual(123)
    })

    it('should transform string primitive field', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_STRING_FIELD)
      expect(result.value.label).toEqual('elementName')
    })

    it('should ignore undefined primitive field', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_PRIMITIVE_FIELD)
      expect(result.value.description).toBeUndefined()
    })

    it('should transform list field', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_LIST_OF_OBJECTS)
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

    it('should not transform list field that contains a single object as it will be done in a dedicated filter', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_LIST_OF_SINGLE_OBJECT)
      expect(result.value.roleaccesses.roleaccess).toEqual(
        {
          accesslevel: '1',
          role: 'BOOKKEEPER',
          searchlevel: '2',
        }
      )
    })

    it('should ignore undefined list field', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_LIST_FIELD)
      expect(result.value.roleaccesses).toBeUndefined()
    })

    it('should ignore undefined object type field', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNDEFINED_OBJECT_FIELD)
      expect(result.value.roleaccesses).toBeUndefined()
    })

    it('should ignore undefined object type inner fields', async () => {
      const result = await transformCustomFieldRecord(
        XML_TEMPLATES.WITH_UNDEFINED_OBJECT_INNER_FIELDS
      )
      expect(result.value.roleaccesses).toBeUndefined()
    })

    it('should not ignore unknown fields', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_UNKNOWN_FIELD)
      expect(result.value.unknownfield).toBeDefined()
    })

    it('should decode html chars', async () => {
      const result = await transformCustomFieldRecord(XML_TEMPLATES.WITH_HTML_CHARS)
      // There is ZeroWidthSpace char between element and Name
      expect(result.value.label).toEqual('Golf & Co’Co element​Name')
    })

    it('should add content value with fileContent as static file', async () => {
      const emailTemplateContent = Buffer.from('Email template content')
      const emailTemplateCustomizationInfo = {
        typeName: EMAIL_TEMPLATE,
        scriptId: 'custemailtmpl_my_script_id',
        values: {
          name: 'email template name',
          [SCRIPT_ID]: 'custemailtmpl_my_script_id',
        },
        fileContent: emailTemplateContent,
        fileExtension: 'html',
      } as TemplateCustomTypeInfo
      const result = await createInstanceElement(emailTemplateCustomizationInfo,
        emailtemplate, mockGetElemIdFunc)
      expect(result.value).toEqual({
        name: 'email template name',
        [SCRIPT_ID]: 'custemailtmpl_my_script_id',
        content: new StaticFile({
          filepath: `netsuite/emailtemplate/${NAME_FROM_GET_ELEM_ID}custemailtmpl_my_script_id.html`,
          content: emailTemplateContent,
        }),
      })
    })

    it('should not add content value when there is no fileContent', async () => {
      const emailTemplateCustomizationInfo = {
        typeName: EMAIL_TEMPLATE,
        scriptId: 'custemailtmpl_my_script_id',
        values: {
          name: 'email template name',
          [SCRIPT_ID]: 'custemailtmpl_my_script_id',
        },
      } as CustomTypeInfo
      const result = await createInstanceElement(emailTemplateCustomizationInfo,
        emailtemplate, mockGetElemIdFunc)
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
        fileContent: Buffer.from('dummy file content'),
      }

      const folderCustomizationInfo: FolderCustomizationInfo = {
        typeName: FOLDER,
        values: {
          description: 'folder description',
        },
        path: ['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder'],
      }

      it('should create instance name correctly for file instance', async () => {
        const result = await createInstanceElement(fileCustomizationInfo, file,
          mockGetElemIdFunc)
        expect(result.elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${naclCase(fileCustomizationInfo.path.join('/'))}`)
      })

      it('should create instance path correctly for file instance', async () => {
        const result = await createInstanceElement(fileCustomizationInfo, file,
          mockGetElemIdFunc)
        expect(result.path)
          .toEqual([NETSUITE, FILE_CABINET_PATH, 'Templates', 'E-mail Templates',
            'Inner EmailTemplates Folder', 'content.html'])
      })

      it('should create instance path correctly for file instance when it has . prefix', async () => {
        const fileCustomizationInfoWithDotPrefix = _.clone(fileCustomizationInfo)
        fileCustomizationInfoWithDotPrefix.path = ['Templates', 'E-mail Templates', '.hiddenFolder', '..hiddenFile.xml']
        const result = await createInstanceElement(fileCustomizationInfoWithDotPrefix,
          file, mockGetElemIdFunc)
        expect(result.path).toEqual(
          [NETSUITE, FILE_CABINET_PATH, 'Templates', 'E-mail Templates', '_hiddenFolder', '_hiddenFile.xml']
        )
      })

      it('should create instance path correctly for folder instance', async () => {
        const result = await createInstanceElement(
          folderCustomizationInfo,
          folder,
          mockGetElemIdFunc
        )
        expect(result.path)
          .toEqual([NETSUITE, FILE_CABINET_PATH, 'Templates', 'E-mail Templates',
            'Inner EmailTemplates Folder', 'Inner EmailTemplates Folder'])
      })

      it('should create instance path correctly for folder instance when it has . prefix', async () => {
        const folderCustomizationInfoWithDotPrefix = _.clone(folderCustomizationInfo)
        folderCustomizationInfoWithDotPrefix.path = ['Templates', 'E-mail Templates', '.hiddenFolder']
        const result = await createInstanceElement(folderCustomizationInfoWithDotPrefix,
          folder, mockGetElemIdFunc)
        expect(result.path)
          .toEqual([NETSUITE, FILE_CABINET_PATH, 'Templates', 'E-mail Templates', '_hiddenFolder',
            '_hiddenFolder'])
      })

      it('should transform path field correctly', async () => {
        const result = await createInstanceElement(fileCustomizationInfo, file,
          mockGetElemIdFunc)
        expect(result.value[PATH])
          .toEqual('/Templates/E-mail Templates/Inner EmailTemplates Folder/content.html')
      })

      it('should set file content in the content field for file instance', async () => {
        const result = await createInstanceElement(fileCustomizationInfo, file,
          mockGetElemIdFunc)
        expect(result.value.content).toEqual(new StaticFile({
          filepath: `${NETSUITE}/${FILE_CABINET_PATH}/Templates/E-mail Templates/Inner EmailTemplates Folder/content.html`,
          content: Buffer.from('dummy file content'),
        }))
      })
    })

    describe('configuration types', () => {
      const featuresCustomizationInfo: CustomTypeInfo = {
        typeName: CONFIG_FEATURES,
        scriptId: CONFIG_FEATURES,
        values: {
          feature: [
            { '@_label': 'test', id: 'TEST', status: 'ENABLED' },
          ],
        },
      }
      it('should create features instance correctly', async () => {
        const result = await createInstanceElement(
          featuresCustomizationInfo,
          companyFeatures,
          mockGetElemIdFunc
        )
        expect(result.elemID.getFullName()).toEqual(`netsuite.${CONFIG_FEATURES}.instance`)
        expect(result.value).toEqual({
          feature: [
            { id: 'TEST', label: 'test', status: 'ENABLED' },
          ],
        })
      })
    })
  })

  describe('toCustomizationInfo', () => {
    const origInstance = new InstanceElement('elementName',
      entitycustomfield, {
        [SCRIPT_ID]: 'custentity_my_script_id',
      })
    let instance: InstanceElement
    beforeEach(() => {
      instance = origInstance.clone()
    })

    it('should transform string primitive field', async () => {
      instance.value.label = 'elementName'
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_STRING_FIELD))
    })

    it('should transform boolean primitive field when is true', async () => {
      instance.value.checkspelling = true
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_TRUE_FIELD))
    })

    it('should transform boolean primitive field when is false', async () => {
      instance.value.checkspelling = false
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_FALSE_FIELD))
    })

    it('should transform number primitive field', async () => {
      instance.value.displayheight = 123
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_NUMBER_FIELD))
    })

    it('should transform cdata primitive field', async () => {
      const addressFormInstance = new InstanceElement('elementName',
        addressForm, {
          name: 'elementName',
          addressTemplate: '<myCdata><field>whoohoo',
        })
      const customizationInfo = await toCustomizationInfo(addressFormInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks('<addressForm>\n'
        + '  <name>elementName</name>\n'
        + '  <addressTemplate><![CDATA[<myCdata><field>whoohoo]]></addressTemplate>\n'
        + '</addressForm>\n'))
    })

    it('should transform fileContent primitive field', async () => {
      const fileContent = Buffer.from('file content')
      const fileInstance = new InstanceElement('elementName',
        file, {
          name: 'elementName',
          [PATH]: '/Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
          content: fileContent,
        })
      const customizationInfo = await toCustomizationInfo(fileInstance)
      expect(isFileCustomizationInfo(customizationInfo)).toEqual(true)
      expect((customizationInfo as FileCustomizationInfo).fileContent).toEqual(fileContent)
    })

    it('should transform when cdata primitive field is undefined', async () => {
      const addressFormInstance = new InstanceElement('elementName',
        addressForm, {
          name: 'elementName',
        })
      const customizationInfo = await toCustomizationInfo(addressFormInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks('<addressForm>\n'
        + '  <name>elementName</name>\n'
        + '</addressForm>\n'))
    })

    it('should transform attribute field', async () => {
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_SCRIPT_ID))
    })

    it('should transform nested attribute field', async () => {
      const customRecordTypeInstance = new InstanceElement('elementName',
        customrecordtype, {
          [SCRIPT_ID]: 'customrecord_my_script_id',
          customrecordcustomfields: {
            customrecordcustomfield: [{
              [SCRIPT_ID]: 'custrecord_my_nested_script_id',
            }],
          },
        })
      const customizationInfo = await toCustomizationInfo(customRecordTypeInstance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_NESTED_ATTRIBUTE))
    })

    it('should not ignore unknown field', async () => {
      instance.value.unknownfield = 'unknownVal'
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_UNKNOWN_FIELD))
    })

    it('should transform list field', async () => {
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
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_LIST_OF_OBJECTS))
    })

    it('should transform empty list field', async () => {
      instance.value.roleaccesses = {
        roleaccess: [],
      }
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_SCRIPT_ID))
    })

    it('should transform empty object field', async () => {
      instance.value.roleaccesses = {}
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      expect(xmlContent).toEqual(removeLineBreaks(XML_TEMPLATES.WITH_SCRIPT_ID))
    })

    it('should encode to html chars', async () => {
      instance.value.label = 'Golf & Co’Co element​Name' // There is ZeroWidthSpace char between element and Name
      const customizationInfo = await toCustomizationInfo(instance)
      const xmlContent = convertToXmlContent(customizationInfo)
      // We use here === instead of expect.toEqual() since jest treats html encoding as equal to
      // the decoded value
      expect(xmlContent === removeLineBreaks(XML_TEMPLATES.WITH_HTML_CHARS)).toBeTruthy()
    })

    it('should transform ordered values for forms', async () => {
      const transactionFormInstance = new InstanceElement('elementName',
        transactionForm, {
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

      const customizationInfo = await toCustomizationInfo(transactionFormInstance)
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

    it('should transform TemplateCustomTypeInfo EMAIL_TEMPLATE', async () => {
      const emailTemplateContent = 'email template content'
      const elementName = 'elementName'
      const emailTemplateInstance = new InstanceElement(elementName,
        emailtemplate, {
          name: elementName,
          content: emailTemplateContent,
        })
      const customizationInfo = await toCustomizationInfo(emailTemplateInstance)
      expect(customizationInfo).toEqual({
        typeName: EMAIL_TEMPLATE,
        values: {
          name: elementName,
        },
        fileContent: emailTemplateContent,
        fileExtension: 'html',
      })
    })

    it('should transform CustomizationInfo EMAIL_TEMPLATE', async () => {
      const elementName = 'elementName'
      const emailTemplateInstance = new InstanceElement(elementName,
        emailtemplate, {
          name: elementName,
        })
      const customizationInfo = await toCustomizationInfo(emailTemplateInstance)
      expect(customizationInfo).toEqual({
        typeName: EMAIL_TEMPLATE,
        values: {
          name: elementName,
        },
      })
    })

    describe('file cabinet types', () => {
      it('should transform file instance', async () => {
        const fileInstance = new InstanceElement('elementName', file, {
          [PATH]: '/Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
          content: 'dummy file content',
          description: 'file description',
        })
        const customizationInfo = await toCustomizationInfo(fileInstance)
        expect(isFileCustomizationInfo(customizationInfo)).toBe(true)
        const fileCustomizationInfo = customizationInfo as FileCustomizationInfo
        expect(fileCustomizationInfo.typeName).toEqual(FILE)
        expect(fileCustomizationInfo.values).toEqual({ description: 'file description' })
        expect(fileCustomizationInfo.path)
          .toEqual(['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder', 'content.html'])
        expect(fileCustomizationInfo.fileContent).toEqual('dummy file content')
      })

      it('should transform folder instance', async () => {
        const folderInstance = new InstanceElement('elementName', folder, {
          [PATH]: '/Templates/E-mail Templates/Inner EmailTemplates Folder',
          description: 'folder description',
        })
        const customizationInfo = await toCustomizationInfo(folderInstance)
        expect(isFolderCustomizationInfo(customizationInfo)).toBe(true)
        const folderCustomizationInfo = customizationInfo as FolderCustomizationInfo
        expect(folderCustomizationInfo.typeName).toEqual(FOLDER)
        expect(folderCustomizationInfo.values).toEqual({ description: 'folder description' })
        expect(folderCustomizationInfo.path)
          .toEqual(['Templates', 'E-mail Templates', 'Inner EmailTemplates Folder'])
      })
    })
  })

  describe('getLookUpName', () => {
    const description = 'description'
    const fileInstance = new InstanceElement('fileInstance', file, {
      [PATH]: '/Templates/file.name',
      [description]: 'some description',
    })

    const workflowInstance = new InstanceElement('instanceName', workflow, {
      [SCRIPT_ID]: 'top_level',
      workflowstates: {
        workflowstate: [
          {
            [SCRIPT_ID]: 'one_nesting',
            workflowactions: [
              {
                setfieldvalueaction: [
                  {
                    [SCRIPT_ID]: 'two_nesting',
                  },
                  {
                    [SCRIPT_ID]: 'two_nesting_with_inner_ref',
                    field: '[scriptid=top_level.one_nesting.two_nesting]',
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        custom_field: {
          refType: BuiltinTypes.STRING,
          annotations: { [SCRIPT_ID]: 'custom_field' },
        },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [SCRIPT_ID]: 'customrecord1',
        instances: {
          instance: {
            record1: {
              [SCRIPT_ID]: 'record1',
            },
          },
        },
      },
    })

    it('should resolve to netsuite path reference representation', async () => {
      const ref = new ReferenceExpression(
        fileInstance.elemID.createNestedID(PATH),
        fileInstance.value[PATH],
        fileInstance
      )
      await expect(getLookUpName({
        ref,
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })).resolves.toEqual('[/Templates/file.name]')
    })

    it('should resolve to netsuite scriptid reference representation', async () => {
      const ref = new ReferenceExpression(
        workflowInstance.elemID.createNestedID(SCRIPT_ID),
        workflowInstance.value[PATH],
        workflowInstance
      )
      await expect(getLookUpName({
        ref,
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })).resolves.toEqual('[scriptid=top_level]')
    })

    it('should resolve to netsuite scriptid reference representation with nesting levels', async () => {
      const ref = new ReferenceExpression(
        workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID),
        'two_nesting',
        workflowInstance
      )
      await expect(getLookUpName({
        ref,
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })).resolves.toEqual('[scriptid=top_level.one_nesting.two_nesting]')
    })

    it('should resolve custom record type to netsuite scriptid reference', async () => {
      const ref = new ReferenceExpression(
        customRecordType.elemID.createNestedID('attr', 'instances', 'instance', 'record1', SCRIPT_ID),
        'record1',
        customRecordType
      )
      await expect(getLookUpName({
        ref,
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })).resolves.toEqual('[scriptid=customrecord1.record1]')
    })

    it('should resolve custom record type field to netsuite scriptid reference', async () => {
      const ref = new ReferenceExpression(
        customRecordType.elemID.createNestedID('field', 'custom_field', SCRIPT_ID),
        'record1',
        customRecordType
      )
      await expect(getLookUpName({
        ref,
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })).resolves.toEqual('[scriptid=customrecord1.custom_field]')
    })

    describe('when the resolved value should be returned', () => {
      it('should return value when topLevelParent is not an instance', async () => {
        const ref = new ReferenceExpression(
          new ElemID(''),
          'resolved_value',
          await workflowInstance.getType(),
        )
        await expect(getLookUpName({
          ref,
          element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
        })).resolves.toEqual(ref.value)
      })

      it('should return value when reference is on FileCabinetType but not on PATH field', async () => {
        const ref = new ReferenceExpression(
          fileInstance.elemID.createNestedID(description),
          fileInstance.value[description],
          fileInstance
        )
        await expect(getLookUpName({
          ref,
          element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
        })).resolves.toEqual(ref.value)
      })

      it('should return value when reference is on CustomType but not on SCRIPT_ID field', async () => {
        const ref = new ReferenceExpression(
          workflowInstance.elemID.createNestedID('workflowstates'),
          workflowInstance.value.workflowstates,
          workflowInstance
        )
        await expect(getLookUpName({
          ref,
          element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
        })).resolves.toEqual(ref.value)
      })
    })
  })
})
