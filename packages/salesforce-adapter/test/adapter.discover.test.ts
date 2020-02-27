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
import _ from 'lodash'
import {
  ObjectType, InstanceElement, ServiceIds, ElemID, BuiltinTypes, Element, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { MetadataInfo } from 'jsforce'
import SalesforceAdapter, { MAX_ITEMS_IN_RETRIEVE_REQUEST } from '../src/adapter'
import Connection from '../src/client/jsforce'
import { Types } from '../src/transformers/transformer'
import { createEncodedZipContent, findElements, ZipFile } from './utils'
import mockAdapter from './adapter'
import { id } from '../src/filters/utils'
import * as constants from '../src/constants'
import { LAYOUT_TYPE_ID } from '../src/filters/layouts'

describe('SalesforceAdapter fetch', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
        metadataAdditionalTypes: [],
        metadataTypeBlacklist: ['Test1', 'Ignored1'],
        instancesBlacklist: ['Test2.instance1', 'Test1.Ignored1'],
      },
    }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('should fetch metadata types', () => {
    const mockSingleMetadataType = (
      xmlName: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[],
      asChild = false,
    ): void => {
      connection.describeGlobal = jest.fn()
        .mockImplementation(async () => ({ sobjects: [] }))

      connection.metadata.describe = jest.fn()
        .mockImplementation(async () => ({
          metadataObjects: [asChild ? { xmlName: 'Base', childXmlNames: [xmlName] } : { xmlName }],
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: fields }))

      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [])
    }

    const mockSingleMetadataInstance = (
      name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: Record<string, any>,
      namespace?: string,
      zipFiles?: ZipFile[]
    ): void => {
      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [{ fullName: name, namespacePrefix: namespace }])

      connection.metadata.read = jest.fn()
        .mockImplementation(async () => data)

      if (!_.isUndefined(zipFiles)) {
        connection.metadata.retrieve = jest.fn().mockImplementation(() =>
          ({ complete: async () => ({ zipFile: await createEncodedZipContent(zipFiles) }) }))
      }
    }

    it('should fetch basic metadata type', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'fullName',
          soapType: 'string',
          valueRequired: true,
        },
        {
          name: 'description',
          soapType: 'string',
          valueRequired: true,
        },
        {
          name: 'isTemplate',
          soapType: 'boolean',
          valueRequired: false,
        },
        {
          name: 'enum',
          soapType: 'SomeEnumType',
          picklistValues: [
            { value: 'yes', defaultValue: true },
            { value: 'no', defaultValue: false },
          ],
        },
      ])
      const result = await adapter.fetch()

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Flow')
      const flow = findElements(result, 'Flow').pop() as ObjectType
      expect(flow.fields.description.type.elemID.name).toBe('string')
      // TODO: remove comment when SALTO-45 will be resolved
      // expect(flow.fields.description.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
      expect(flow.fields.isTemplate.type.elemID.name).toBe('boolean')
      expect(flow.fields.isTemplate.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
      expect(flow.fields.enum.type.elemID.name).toBe('string')
      expect(flow.fields.enum.annotations[CORE_ANNOTATIONS.DEFAULT]).toBe('yes')
      // Note the order here is important because we expect restriction values to be sorted
      expect(flow.fields.enum.annotations[CORE_ANNOTATIONS.VALUES]).toEqual(['no', 'yes'])
      expect(flow.path).toEqual([constants.SALESFORCE, constants.TYPES_PATH, 'Flow'])
      expect(flow.fields[constants.INSTANCE_FULL_NAME_FIELD].type).toEqual(BuiltinTypes.SERVICE_ID)
      expect(flow.annotationTypes[constants.METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(flow.annotations[constants.METADATA_TYPE]).toEqual('Flow')
    })
    it('should fetch nested metadata types', async () => {
      mockSingleMetadataType('NestingType', [
        { // Nested field with multiple subfields returns fields as array
          name: 'field',
          soapType: 'NestedType',
          fields: [
            {
              name: 'nestedStr',
              soapType: 'string',
            },
            {
              name: 'nestedNum',
              soapType: 'double',
            },
            {
              name: 'doubleNested',
              soapType: 'SingleFieldType',
              fields: {
                name: 'str',
                soapType: 'string',
              },
            },
          ],
        },
        { // Nested field with a single subfield returns fields as an object
          name: 'otherField',
          soapType: 'SingleFieldType',
          fields: {
            name: 'str',
            soapType: 'string',
          },
        },
      ])

      const result = await adapter.fetch()

      expect(result).toHaveLength(_.concat(
        Object.keys(Types.primitiveDataTypes),
        Object.keys(Types.compoundDataTypes),
        Object.keys(Types.formulaDataTypes)
      ).length
        + 2 /* LookupFilter & filter items */
        + 1 /* rollup summary operation */
        + 3
        + 2 /* mask char & type */
        + 1 /* security classification */
        + 1 /* business status */
        + 1 /* treat blank as */
        + 1 /* value set */
        + 2 /* field dependency & value settings */
        + 10 /* range restrictions */)

      const types = _.assign({}, ...result.map(t => ({ [id(t)]: t })))
      const nestingType = types['salesforce.NestingType']
      const nestedType = types['salesforce.NestedType']
      const singleField = types['salesforce.SingleFieldType']
      expect(nestingType).toBeDefined()
      expect(nestingType.fields.field.type.elemID).toEqual(nestedType.elemID)
      expect(nestingType.fields.otherField.type.elemID).toEqual(singleField.elemID)
      expect(nestedType).toBeDefined()
      expect(nestedType.fields.nestedStr.type.elemID).toEqual(BuiltinTypes.STRING.elemID)
      expect(nestedType.fields.nestedNum.type.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
      expect(nestedType.fields.doubleNested.type.elemID).toEqual(singleField.elemID)
      expect(singleField).toBeDefined()
      expect(singleField.fields.str.type.elemID).toEqual(BuiltinTypes.STRING.elemID)
    })

    it('should fetch metadata instance', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'bla',
          soapType: 'Bla',
          fields: [
            {
              name: 'bla',
              soapType: 'double',
            },
            {
              name: 'bla2',
              soapType: 'boolean',
            },
            {
              name: 'bla3',
              soapType: 'boolean',
            },
          ],
        },
        {
          name: 'fullName',
          soapType: 'string',
        },
      ])

      mockSingleMetadataInstance('FlowInstance', {
        fullName: 'FlowInstance',
        bla: { bla: '55', bla2: 'false', bla3: 'true' },
      })

      const result = await adapter.fetch()
      const flow = findElements(result, 'Flow', 'FlowInstance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
      expect(flow.value.bla.bla).toBe(55)
      expect(flow.value.bla.bla2).toBe(false)
      expect(flow.value.bla.bla3).toBe(true)
    })

    it('should use existing elemID when fetching metadata instance', async () => {
      ({ connection, adapter } = mockAdapter({
        adapterParams: {
          getElemIdFunc: (adapterName: string, serviceIds: ServiceIds, name: string):
            ElemID => new ElemID(adapterName, name === 'FlowInstance'
            && serviceIds[constants.INSTANCE_FULL_NAME_FIELD] === 'FlowInstance'
            ? 'my_FlowInstance' : name),
        },
      }))

      mockSingleMetadataType('Flow', [
        {
          name: 'bla',
          soapType: 'Bla',
          fields: [
            {
              name: 'bla',
              soapType: 'double',
            },
            {
              name: 'bla2',
              soapType: 'boolean',
            },
            {
              name: 'bla3',
              soapType: 'boolean',
            },
          ],
        },
        {
          name: 'fullName',
          soapType: 'string',
        },
      ])

      mockSingleMetadataInstance('FlowInstance', {
        fullName: 'FlowInstance',
        bla: { bla: '55', bla2: 'false', bla3: 'true' },
      })

      const result = await adapter.fetch()
      const flow = findElements(result, 'Flow', 'my_FlowInstance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
      expect(flow.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('FlowInstance')
    })

    it('should fetch complicated metadata instance', async () => {
      mockSingleMetadataType('Layout', [
        {
          name: 'fullName', soapType: 'string', valueRequired: true,
        },
        {
          fields: [
            {
              name: 'label', soapType: 'string', valueRequired: true,
            },
            {
              name: 'style', soapType: 'string', valueRequired: false,
            },
            {
              fields: [{
                fields: [
                  {
                    name: 'field', soapType: 'string', valueRequired: 'true',
                  }, {
                    name: 'behavior', soapType: 'string', valueRequired: 'true',
                  },
                ],
                name: 'layoutItems',
                soapType: 'LayoutItem',
                valueRequired: 'true',
              }, {
                name: 'reserved', soapType: 'string', valueRequired: 'true',
              }],
              name: 'layoutColumns',
              soapType: 'LayoutColumn',
              valueRequired: true,
            }],
          name: 'layoutSections',
          soapType: 'LayoutSection',
        },
        {
          fields: [
            {
              // This use her 'String' and not 'string' on purpose, we saw similar response.
              name: 'name', soapType: 'String', valueRequired: true,
            },
            {
              fields: [
                {
                  name: 'stringValue', soapType: 'string', valueRequired: 'true',
                }],
              name: 'value',
              soapType: 'Value',
              valueRequired: true,
            }],
          name: 'processMetadataValues',
          soapType: 'ProcessMetadataValue',
        },
      ])

      const layoutName = 'Order-Order Layout'
      mockSingleMetadataInstance(layoutName, {
        fullName: layoutName,
        layoutSections: [{
          label: 'Description Information',
          layoutColumns: [{ layoutItems: { behavior: 'Edit', field: 'Description' } },
            { layoutItems: { behavior: 'Edit2', field: 'Description2' } }],
        }, {
          label: 'Additional Information',
          layoutColumns: ['', ''],
        }, {
          layoutColumns: ['', '', ''],
          style: 'CustomLinks',
        },
        {
          layoutColumns: '',
        }],
        processMetadataValues: [{ name: 'dataType', value: { stringValue: 'Boolean' } },
          { name: 'leftHandSideReferenceTo', value: '' },
          { name: 'leftHandSideReferenceTo2', value: { stringValue: '' } },
          {
            name: 'leftHandSideReferenceTo3',
            value: { stringValue: { $: { 'xsi:nil': 'true' } } },
          }],
      })

      const result = await adapter.fetch()
      const layout = findElements(result, 'Layout', 'Order_Layout').pop() as InstanceElement
      expect(layout.type.elemID).toEqual(LAYOUT_TYPE_ID)
      expect(layout.value[constants.INSTANCE_FULL_NAME_FIELD]).toBe(layoutName)
      expect(layout.value.layoutSections.length).toBe(3)
      expect(layout.value.layoutSections[0].label).toBe('Description Information')
      expect(layout.value.layoutSections[0].layoutColumns[0].layoutItems.behavior).toBe('Edit')
      expect(layout.value.layoutSections[0].layoutColumns[1].layoutItems.field).toBe('Description2')
      expect(layout.value.layoutSections[1].layoutColumns).toBeUndefined()
      expect(layout.value.layoutSections[1].label).toBe('Additional Information')
      expect(layout.value.layoutSections[2].style).toBe('CustomLinks')
      expect(
        (layout.type.fields.processMetadataValues.type as ObjectType).fields.name.type.elemID.name
      ).toBe('string')
      expect(layout.value.processMetadataValues[1].name).toBe('leftHandSideReferenceTo')
      expect(layout.value.processMetadataValues[1].value).toBeUndefined()
      expect(layout.value.processMetadataValues[2].name).toBe('leftHandSideReferenceTo2')
      expect(layout.value.processMetadataValues[2].value).toBeUndefined()
      expect(layout.value.processMetadataValues[3].name).toBe('leftHandSideReferenceTo3')
      expect(layout.value.processMetadataValues[3].value).toBeUndefined()
    })

    it('should fetch metadata types lists', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'fullName',
          soapType: 'string',
        },
        {
          name: 'listTest',
          soapType: 'ListTest',
          fields: [{
            name: 'editable',
            soapType: 'boolean',
          },
          {
            name: 'field',
            soapType: 'string',
          }],
        },
      ])

      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [{ fullName: 'FlowInstance' }, { fullName: 'FlowInstance2' }])

      connection.metadata.read = jest.fn()
        .mockImplementation(async () => ([
          {
            fullName: 'FlowInstance',
            listTest: [
              { field: 'Field1', editable: 'true' },
              { field: 'Field2', editable: 'false' },
            ],
          },
          {
            fullName: 'FlowInstance2',
            listTest: { field: 'Field11', editable: 'true' },
          },
        ]))

      const result = await adapter.fetch()
      const flow = findElements(result, 'Flow', 'FlowInstance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
      expect((flow.type as ObjectType).fields.listTest.isList).toBe(true)

      expect(flow.elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow', 'instance', 'FlowInstance'))
      expect(flow.value.listTest[0].field).toEqual('Field1')
      expect(flow.value.listTest[0].editable).toBe(true)
      expect(flow.value.listTest[1].field).toEqual('Field2')
      expect(flow.value.listTest[1].editable).toBe(false)

      const flow2 = findElements(result, 'Flow', 'FlowInstance2').pop() as InstanceElement
      expect(flow2.value.listTest[0].field).toEqual('Field11')
      expect(flow2.value.listTest[0].editable).toBe(true)
    })

    it('should fetch settings instance', async () => {
      mockSingleMetadataType('Settings', [])
      mockSingleMetadataInstance('Quote', { fullName: 'QuoteSettings' })

      await adapter.fetch()

      expect(connection.metadata.read).toHaveBeenCalledWith('QuoteSettings', ['Quote'])
    })

    it('should not fetch child metadata type', async () => {
      mockSingleMetadataType('Child', [
        {
          name: 'description',
          soapType: 'string',
          valueRequired: true,
        },
      ], true)
      await adapter.fetch()

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls.length).toBe(1)
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Base')
    })

    it('should fetch metadata instances using retrieve', async () => {
      mockSingleMetadataType('EmailTemplate', [{
        name: 'fullName',
        soapType: 'string',
        valueRequired: true,
      },
      {
        name: 'name',
        soapType: 'string',
        valueRequired: false,
      },
      {
        name: 'content',
        soapType: 'string',
        valueRequired: false,
      }])

      mockSingleMetadataInstance('MyFolder/MyEmailTemplate',
        { fullName: 'MyFolder/MyEmailTemplate' }, undefined,
        [{ path: 'unpackaged/email/MyFolder/MyEmailTemplate.email-meta.xml',
          content: '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">\n'
            + '    <available>false</available>\n'
            + '    <encodingKey>ISO-8859-1</encodingKey>\n'
            + '    <name>My Email Template</name>\n'
            + '    <style>none</style>\n'
            + '    <subject>MySubject</subject>\n'
            + '    <type>text</type>\n'
            + '    <uiType>Aloha</uiType>\n'
            + '</EmailTemplate>\n' },
        { path: 'unpackaged/email/MyFolder/MyEmailTemplate.email',
          content: 'Email Body' }])

      const result = await adapter.fetch()
      const [testElem] = findElements(result, 'EmailTemplate', 'MyFolder_MyEmailTemplate')
      const testInst = testElem as InstanceElement
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.RECORDS_PATH, 'EmailTemplate', 'MyFolder_MyEmailTemplate'])
      expect(testInst.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyFolder/MyEmailTemplate')
      expect(testInst.value.name).toEqual('My Email Template')
      expect(testInst.value.content).toEqual('Email Body')
    })

    it('should fetch metadata instances using retrieve in chunks', async () => {
      mockSingleMetadataType('ApexClass', [{
        name: 'fullName',
        soapType: 'string',
        valueRequired: true,
      },
      {
        name: 'content',
        soapType: 'string',
        valueRequired: false,
      }])

      const generateInstancesMocks = (numberOfInstances: number): MetadataInfo[] =>
        Array.from(Array(numberOfInstances), (_x, index) => ({ fullName: `dummy${index}` }))

      const metadataInfos = generateInstancesMocks(MAX_ITEMS_IN_RETRIEVE_REQUEST * 2)
      connection.metadata.list = jest.fn()
        .mockImplementation(async () => metadataInfos)

      const mockRetrieve = jest.fn().mockReturnValueOnce(
        ({ complete: async () => ({ zipFile: await createEncodedZipContent(
          [{ path: 'unpackaged/classes/MyApexClass.cls-meta.xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <apiVersion>47.0</apiVersion>\n'
              + '    <status>Active</status>\n'
              + '</ApexClass>\n' }, { path: 'unpackaged/classes/MyApexClass.cls',
            content: 'public class MyApexClass {\n'
              + '    public void printLog() {\n'
              + '        System.debug(\'Instance1\');\n'
              + '    }\n'
              + '}' }]
        ) }) })
      ).mockReturnValueOnce(
        ({ complete: async () => ({ zipFile: await createEncodedZipContent(
          [{ path: 'unpackaged/classes/MyApexClass2.cls-meta.xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <apiVersion>47.0</apiVersion>\n'
              + '    <status>Active</status>\n'
              + '</ApexClass>\n' }, { path: 'unpackaged/classes/MyApexClass2.cls',
            content: 'public class MyApexClass2 {\n'
              + '    public void printLog() {\n'
              + '        System.debug(\'Instance2\');\n'
              + '    }\n'
              + '}' }]
        ) }) })
      )
      connection.metadata.retrieve = mockRetrieve

      const result = await adapter.fetch()
      expect(mockRetrieve.mock.calls.length).toBe(2)
      const [first] = findElements(result, 'ApexClass', 'MyApexClass') as InstanceElement[]
      const [second] = findElements(result, 'ApexClass', 'MyApexClass2') as InstanceElement[]
      expect(first.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyApexClass')
      expect(second.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyApexClass2')
      expect(first.value.content.includes('Instance1')).toBeTruthy()
      expect(second.value.content.includes('Instance2')).toBeTruthy()
    })

    it('should fetch metadata instances folders using retrieve', async () => {
      connection.metadata.describe = jest.fn()
        .mockImplementation(async () => ({
          metadataObjects: [{ xmlName: 'EmailTemplate' }, { xmlName: 'EmailFolder' }],
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: [{
          name: 'fullName',
          soapType: 'string',
          valueRequired: true,
        },
        {
          name: 'name',
          soapType: 'string',
          valueRequired: false,
        }] }))

      mockSingleMetadataInstance('MyFolder',
        { fullName: 'MyFolder' }, undefined,
        [{ path: 'unpackaged/email/MyFolder-meta.xml',
          content: '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">\n'
            + '    <accessType>Public</accessType>\n'
            + '    <name>My folder</name>\n'
            + '    <publicFolderAccess>ReadWrite</publicFolderAccess>\n'
            + '</EmailFolder>\n' }])

      const result = await adapter.fetch()
      const [testElem] = findElements(result, 'EmailFolder', 'MyFolder')
      const testInst = testElem as InstanceElement
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.RECORDS_PATH, 'EmailFolder', 'MyFolder'])
      expect(testInst.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyFolder')
      expect(testInst.value.name).toEqual('My folder')
    })

    it('should fetch metadata instances with namespace using retrieve', async () => {
      mockSingleMetadataType('ApexPage', [])
      const namespaceName = 'th_con_app'
      mockSingleMetadataInstance('th_con_app__ThHomepage', { fullName: 'th_con_app__ThHomepage' },
        namespaceName, [{ path: 'unpackaged/pages/th_con_app__ThHomepage.page-meta.xml',
          content: '<?xml version="1.0" encoding="UTF-8"?>\n'
          + '<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">\n'
          + '    <apiVersion>38.0</apiVersion>\n'
          + '    <availableInTouch>false</availableInTouch>\n'
          + '    <confirmationTokenRequired>false</confirmationTokenRequired>\n'
          + '    <label>ThHomepage</label>\n'
          + '</ApexPage>\n' }, { path: 'unpackaged/pages/th_con_app__ThHomepage.page',
          content: '<apex:page sidebar="false" standardStylesheets="false"/>' }])

      const result = await adapter.fetch()
      const [testInst] = findElements(result, 'ApexPage', 'th_con_app__ThHomepage')
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH,
          namespaceName, constants.RECORDS_PATH, 'ApexPage', 'th_con_app__ThHomepage'])
    })

    it('should fetch metadata instances with namespace', async () => {
      mockSingleMetadataType('Test', [])
      const namespaceName = 'asd'
      mockSingleMetadataInstance('Test', { fullName: 'asd__Test' }, namespaceName)

      const result = await adapter.fetch()
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH,
          namespaceName, constants.RECORDS_PATH, 'Test', 'asd__Test'])
    })

    it('should fetch metadata instances with namespace when fullname already includes the namespace', async () => {
      const namespaceName = 'asd'
      mockSingleMetadataType('Test', [])
      mockSingleMetadataInstance('asd__Test', { fullName: 'asd__Test' }, namespaceName)

      const result = await adapter.fetch()
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual(
        [constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH, namespaceName,
          constants.RECORDS_PATH, 'Test', 'asd__Test']
      )
    })

    describe('should not fetch blacklist metadata types and instance', () => {
      let result: Element[] = []
      beforeEach(async () => {
        connection.describeGlobal = jest.fn().mockImplementation(async () => ({ sobjects: [] }))
        connection.metadata.describe = jest.fn().mockImplementation(async () => ({
          metadataObjects: [{ xmlName: 'Test1' }, { xmlName: 'Test2' }, { xmlName: 'Test3' }],
        }))
        connection.metadata.describeValueType = jest.fn().mockImplementation(
          async (typeName: string) => {
            if (typeName.endsWith('Test1')) {
              throw new Error('fake error')
            }
            return { valueTypeFields: [] }
          }
        )
        connection.metadata.list = jest.fn().mockImplementation(
          async () => [{ fullName: 'instance1' }]
        )
        connection.metadata.read = jest.fn().mockImplementation(
          async (typeName: string, fullNames: string | string[]) => {
            if (typeName === 'Test2') {
              throw new Error('fake error')
            }
            return { fullName: Array.isArray(fullNames) ? fullNames[0] : fullNames }
          }
        )

        result = await adapter.fetch()
      })

      it('should skip blacklist types', () => {
        expect(findElements(result, 'Test1')).toHaveLength(0)
        expect(findElements(result, 'Test2')).toHaveLength(1)
        expect(findElements(result, 'Test3')).toHaveLength(1)
      })

      it('should skip blacklist instances', () => {
        expect(findElements(result, 'Test2', 'instance1')).toHaveLength(0)
        expect(findElements(result, 'Test3', 'instance1')).toHaveLength(1)
      })
    })
  })
})
