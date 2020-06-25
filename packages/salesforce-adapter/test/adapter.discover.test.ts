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
  ObjectType, InstanceElement, ServiceIds, ElemID, BuiltinTypes,
  Element, CORE_ANNOTATIONS, FetchResult, isListType, ListType, getRestriction,
} from '@salto-io/adapter-api'
import { MetadataInfo } from 'jsforce'
import { values, collections } from '@salto-io/lowerdash'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/jsforce'
import { Types } from '../src/transformers/transformer'
import { findElements, ZipFile, MockInterface } from './utils'
import mockAdapter from './adapter'
import { id } from '../src/filters/utils'
import * as constants from '../src/constants'
import {
  INSTANCES_REGEX_SKIPPED_LIST, METADATA_TYPES_SKIPPED_LIST,
  MAX_CONCURRENT_RETRIEVE_REQUESTS, MAX_ITEMS_IN_RETRIEVE_REQUEST,
  HIDE_TYPES_IN_NACLS,
} from '../src/types'
import { LAYOUT_TYPE_ID } from '../src/filters/layouts'
import { MockFilePropertiesInput, MockDescribeResultInput, MockDescribeValueResultInput, mockDescribeResult, mockDescribeValueResult, mockFileProperties, mockRetrieveResult } from './connection'

describe('SalesforceAdapter fetch', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  const testMetadataTypesSkippedList = ['Test1', 'Ignored1']
  const testInstancesRegexSkippedList = [
    'Test2.instance1', 'SkippedList$', '^ReportFolder.skip$', 'AssignmentRules.MyRules',
  ]
  const testMaxConcurrentRetrieveRequests = 4
  const testMaxItemsInRetrieveRequest = 100
  const testHideTypesInNacls = true

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
        metadataAdditionalTypes: [],
        config: {
          metadataTypesSkippedList: testMetadataTypesSkippedList,
          instancesRegexSkippedList: testInstancesRegexSkippedList,
          maxConcurrentRetrieveRequests: testMaxConcurrentRetrieveRequests,
          maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
          hideTypesInNacls: testHideTypesInNacls,
        },
      },
    }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('should fetch metadata types', () => {
    type MockInstanceParams = {
      props: Omit<MockFilePropertiesInput, 'type'> & Partial<Pick<MockFilePropertiesInput, 'type'>>
      values: MetadataInfo & Record<string, unknown>
      zipFiles?: ZipFile[]
    }
    const mockMetadataType = (
      typeDef: MockDescribeResultInput,
      valueDef: MockDescribeValueResultInput,
      instances?: MockInstanceParams[],
    ): void => {
      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult(typeDef)
      )
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult(valueDef)
      )
      if (instances !== undefined) {
        connection.metadata.list.mockResolvedValue(
          instances.map(inst => mockFileProperties({ type: typeDef.xmlName, ...inst.props }))
        )
        connection.metadata.read.mockResolvedValue(
          instances.map(inst => inst.values)
        )
        const zipFiles = instances.map(inst => inst.zipFiles).filter(values.isDefined)
        if (!_.isEmpty(zipFiles)) {
          _.chunk(zipFiles, testMaxItemsInRetrieveRequest).forEach(
            chunkFiles => connection.metadata.retrieve.mockReturnValueOnce(mockRetrieveResult({
              zipFiles: _.flatten(chunkFiles),
            })),
          )
        }
      }
    }

    it('should fetch basic metadata type', async () => {
      mockMetadataType(
        { xmlName: 'Flow' },
        {
          valueTypeFields: [
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
                { value: 'yes', defaultValue: true, active: true },
                { value: 'no', defaultValue: false, active: true },
              ],
            },
          ],
        }
      )
      const { elements: result } = await adapter.fetch()

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
      expect(getRestriction(flow.fields.enum).values).toEqual(['no', 'yes'])
      expect(flow.path).toEqual([constants.SALESFORCE, constants.TYPES_PATH, 'Flow'])
      expect(flow.fields[constants.INSTANCE_FULL_NAME_FIELD].type).toEqual(BuiltinTypes.SERVICE_ID)
      expect(flow.annotationTypes[constants.METADATA_TYPE]).toEqual(BuiltinTypes.SERVICE_ID)
      expect(flow.annotations[constants.METADATA_TYPE]).toEqual('Flow')
    })
    it('should fetch nested metadata types', async () => {
      mockMetadataType(
        { xmlName: 'NestingType' },
        {
          valueTypeFields: [
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
                  fields: [
                    {
                      name: 'str',
                      soapType: 'string',
                    },
                  ],
                },
              ],
            },
            { // Nested field with a single subfield returns fields as an object
              name: 'otherField',
              soapType: 'SingleFieldType',
              fields: [
                {
                  name: 'str',
                  soapType: 'string',
                },
              ],
            },
          ],
        }
      )

      const { elements: result } = await adapter.fetch()

      expect(result).toHaveLength(_.concat(
        Object.keys(Types.primitiveDataTypes),
        Object.keys(Types.compoundDataTypes),
        Object.keys(Types.formulaDataTypes),
        Object.keys(Types.getAllMissingTypes()),
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

    describe('with metadata instance', () => {
      const mockFlowType = (): void => {
        mockMetadataType(
          { xmlName: 'Flow' },
          {
            valueTypeFields: [
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
            ],
          },
          [
            {
              props: {
                fullName: 'FlowInstance',
                fileName: 'flows/FlowInstance.flow',
              },
              values: {
                fullName: 'FlowInstance',
                bla: { bla: '55', bla2: 'false', bla3: 'true' },
              },
            },
          ]
        )
      }

      it('should fetch metadata instance', async () => {
        mockFlowType()
        const { elements: result } = await adapter.fetch()
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

        mockFlowType()

        const { elements: result } = await adapter.fetch()
        const flow = findElements(result, 'Flow', 'my_FlowInstance').pop() as InstanceElement
        expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
        expect(flow.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('FlowInstance')
      })
    })

    describe('with complicated metadata instance', () => {
      const layoutName = 'Order-Order Layout'
      beforeEach(() => {
        mockMetadataType(
          { xmlName: 'Layout' },
          {
            valueTypeFields: [
              { name: 'fullName', soapType: 'string', valueRequired: true },
              {
                fields: [
                  { name: 'label', soapType: 'string', valueRequired: true },
                  { name: 'style', soapType: 'string', valueRequired: false },
                  {
                    fields: [
                      {
                        fields: [
                          { name: 'field', soapType: 'string', valueRequired: true },
                          { name: 'behavior', soapType: 'string', valueRequired: true },
                        ],
                        name: 'layoutItems',
                        soapType: 'LayoutItem',
                        valueRequired: true,
                      },
                      { name: 'reserved', soapType: 'string', valueRequired: true },
                    ],
                    name: 'layoutColumns',
                    soapType: 'LayoutColumn',
                    valueRequired: true,
                  },
                ],
                name: 'layoutSections',
                soapType: 'LayoutSection',
              },
              {
                fields: [
                  // This returns 'String' and not 'string' on purpose, we saw similar response.
                  { name: 'name', soapType: 'String', valueRequired: true },
                  {
                    fields: [
                      { name: 'stringValue', soapType: 'string', valueRequired: true },
                    ],
                    name: 'value',
                    soapType: 'Value',
                    valueRequired: true,
                  },
                ],
                name: 'processMetadataValues',
                soapType: 'ProcessMetadataValue',
              },
            ],
          },
          [
            {
              props: {
                fullName: layoutName,
                fileName: `layouts/${layoutName}.layout`,
              },
              values: {
                fullName: layoutName,
                layoutSections: [
                  {
                    label: 'Description Information',
                    layoutColumns: [
                      { layoutItems: [{ behavior: 'Edit', field: 'Description' }] },
                      { layoutItems: [{ behavior: 'Edit2', field: 'Description2' }] },
                    ],
                  },
                  { label: 'Additional Information', layoutColumns: ['', ''] },
                  { layoutColumns: ['', '', ''], style: 'CustomLinks' },
                  { layoutColumns: '' },
                ],
                processMetadataValues: [
                  { name: 'dataType', value: { stringValue: 'Boolean' } },
                  { name: 'leftHandSideReferenceTo', value: '' },
                  { name: 'leftHandSideReferenceTo2', value: { stringValue: '' } },
                  {
                    name: 'leftHandSideReferenceTo3',
                    value: { stringValue: { $: { 'xsi:nil': 'true' } } },
                  },
                ],
              },
            },
          ],
        )
      })

      it('should fetch complicated metadata instance', async () => {
        const { elements: result } = await adapter.fetch()
        const layout = findElements(result, 'Layout', 'Order_Layout').pop() as InstanceElement
        expect(layout.type.elemID).toEqual(LAYOUT_TYPE_ID)
        expect(layout.value[constants.INSTANCE_FULL_NAME_FIELD]).toBe(layoutName)
        expect(layout.value.layoutSections.length).toBe(3)
        expect(layout.value.layoutSections[0].label).toBe('Description Information')
        expect(layout.value.layoutSections[0].layoutColumns[0].layoutItems[0].behavior).toBe('Edit')
        expect(layout.value.layoutSections[0].layoutColumns[1].layoutItems[0].field).toBe('Description2')
        expect(layout.value.layoutSections[1].layoutColumns).toBeUndefined()
        expect(layout.value.layoutSections[1].label).toBe('Additional Information')
        expect(layout.value.layoutSections[2].style).toBe('CustomLinks')
        expect(
          ((layout.type.fields.processMetadataValues.type as ListType)
            .innerType as ObjectType).fields.name.type.elemID.name
        ).toBe('string')
        expect(layout.value.processMetadataValues[1].name).toBe('leftHandSideReferenceTo')
        expect(layout.value.processMetadataValues[1].value).toBeUndefined()
        expect(layout.value.processMetadataValues[2].name).toBe('leftHandSideReferenceTo2')
        expect(layout.value.processMetadataValues[2].value).toBeUndefined()
        expect(layout.value.processMetadataValues[3].name).toBe('leftHandSideReferenceTo3')
        expect(layout.value.processMetadataValues[3].value).toBeUndefined()
      })
    })

    it('should fetch metadata types lists', async () => {
      mockMetadataType(
        { xmlName: 'Flow' },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string' },
            {
              name: 'listTest',
              soapType: 'ListTest',
              fields: [
                { name: 'editable', soapType: 'boolean' },
                { name: 'field', soapType: 'string' },
              ],
            },
          ],
        },
        [
          {
            props: { fullName: 'FlowInstance' },
            values: {
              fullName: 'FlowInstance',
              listTest: [
                { field: 'Field1', editable: 'true' },
                { field: 'Field2', editable: 'false' },
              ],
            },
          },
          {
            props: { fullName: 'FlowInstance2' },
            values: {
              fullName: 'FlowInstance2',
              listTest: { field: 'Field11', editable: 'true' },
            },
          },
        ]
      )

      const { elements: result } = await adapter.fetch()
      const flow = findElements(result, 'Flow', 'FlowInstance').pop() as InstanceElement
      expect(flow.type.elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
      expect(isListType((flow.type as ObjectType).fields.listTest.type)).toBeTruthy()

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
      mockMetadataType(
        { xmlName: 'Settings' },
        { valueTypeFields: [] },
        [
          {
            props: { fullName: 'Quote' },
            values: { fullName: 'Quote' },
          },
        ]
      )

      await adapter.fetch()

      expect(connection.metadata.read).toHaveBeenCalledWith('QuoteSettings', ['Quote'])
    })

    it('should not fetch child metadata type', async () => {
      mockMetadataType(
        { xmlName: 'Base', childXmlNames: ['Child'] },
        { valueTypeFields: [] },
      )
      await adapter.fetch()

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls.length).toBe(1)
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Base')
    })

    it('should fetch metadata instances using retrieve in chunks', async () => {
      mockMetadataType(
        { xmlName: 'ApexClass', metaFile: true, suffix: 'cls', directoryName: 'classes' },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'content', soapType: 'string', valueRequired: false },
          ],
        },
        _.times(testMaxItemsInRetrieveRequest * 2).map(
          index => ({
            props: { fullName: `MyClass${index}`, fileName: `classes/MyClass${index}.cls` },
            values: { fullName: `MyClass${index}` },
            zipFiles: [
              {
                path: `unpackaged/classes/MyClass${index}.cls-meta.xml`,
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>47.0</apiVersion>
  <status>Active</status>
</ApexClass>
`,
              },
              {
                path: `unpackaged/classes/MyClass${index}.cls`,
                content: `
public class MyClass${index} {
  public void printLog() {
    System.debug('Instance${index}');
  }'
}
`,
              },
            ],
          })
        )
      )

      const { elements: result } = await adapter.fetch()
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(2)
      const [first] = findElements(result, 'ApexClass', 'MyClass0') as InstanceElement[]
      const [second] = findElements(result, 'ApexClass', 'MyClass1') as InstanceElement[]
      expect(first.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyClass0')
      expect(second.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyClass1')
      expect(first.value.content.content.toString().includes('Instance0')).toBeTruthy()
      expect(second.value.content.content.toString().includes('Instance1')).toBeTruthy()
    })

    it('should fetch metadata instances folders using retrieve', async () => {
      mockMetadataType(
        { xmlName: 'EmailTemplate', inFolder: true, metaFile: true },
        {
          parentField: {
            name: '',
            soapType: 'string',
            foreignKeyDomain: 'EmailFolder',
          },
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'name', soapType: 'string', valueRequired: false },
          ],
        },
        [
          {
            props: { fullName: 'MyFolder', fileName: 'email/MyFolder', type: 'EmailFolder' },
            values: { fullName: 'MyFolder' },
            zipFiles: [
              {
                path: 'unpackaged/email/MyFolder-meta.xml',
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">
  <accessType>Public</accessType>
  <name>My folder</name>
  <publicFolderAccess>ReadWrite</publicFolderAccess>
</EmailFolder>
`,
              },
            ],
          },
        ]
      )

      const { elements: result } = await adapter.fetch()
      const [testElem] = findElements(result, 'EmailFolder', 'MyFolder')
      const testInst = testElem as InstanceElement
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.RECORDS_PATH, 'EmailFolder', 'MyFolder'])
      expect(testInst.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyFolder')
      expect(testInst.value.name).toEqual('My folder')
    })

    it('should fetch metadata instances with namespace using retrieve', async () => {
      const namespaceName = 'th_con_app'
      mockMetadataType(
        { xmlName: 'ApexPage', metaFile: true },
        { valueTypeFields: [{ name: 'content', soapType: 'string' }] },
        [
          {
            props: {
              fullName: 'th_con_app__ThHomepage',
              fileName: 'pages/th_con_app__ThHomepage.page',
              namespacePrefix: namespaceName,
            },
            values: { fullName: 'th_con_app__ThHomepage' },
            zipFiles: [
              {
                path: 'unpackaged/pages/th_con_app__ThHomepage.page-meta.xml',
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>38.0</apiVersion>
  <availableInTouch>false</availableInTouch>
  <confirmationTokenRequired>false</confirmationTokenRequired>
  <label>ThHomepage</label>
</ApexPage>
`,
              },
              {
                path: 'unpackaged/pages/th_con_app__ThHomepage.page',
                content: '<apex:page sidebar="false" standardStylesheets="false"/>',
              },
            ],
          },
        ]
      )

      const { elements: result } = await adapter.fetch()
      const [testInst] = findElements(result, 'ApexPage', 'th_con_app__ThHomepage')
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH,
          namespaceName, constants.RECORDS_PATH, 'ApexPage', 'th_con_app__ThHomepage'])
    })

    it('should fetch metadata instances with namespace', async () => {
      const namespaceName = 'asd'
      mockMetadataType(
        { xmlName: 'Test' },
        { valueTypeFields: [] },
        [
          {
            props: { fullName: 'Test', namespacePrefix: namespaceName },
            values: { fullName: `${namespaceName}__Test` },
          },
        ]
      )

      const { elements: result } = await adapter.fetch()
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path)
        .toEqual([constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH,
          namespaceName, constants.RECORDS_PATH, 'Test', 'asd__Test'])
    })

    it('should fetch metadata instances with namespace when fullname already includes the namespace', async () => {
      const namespaceName = 'asd'
      mockMetadataType(
        { xmlName: 'Test' },
        { valueTypeFields: [] },
        [
          {
            props: { fullName: `${namespaceName}__Test`, namespacePrefix: namespaceName },
            values: { fullName: `${namespaceName}__Test` },
          },
        ]
      )

      const { elements: result } = await adapter.fetch()
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual(
        [constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH, namespaceName,
          constants.RECORDS_PATH, 'Test', 'asd__Test']
      )
    })

    describe('should not fetch skippedlist metadata types, instance and folders', () => {
      let result: FetchResult
      let elements: Element[] = []
      beforeEach(async () => {
        connection.describeGlobal.mockImplementation(async () => ({ sobjects: [] }))
        connection.metadata.describe.mockResolvedValue(mockDescribeResult(
          { xmlName: 'Test1' },
          { xmlName: 'Test2' },
          { xmlName: 'Test3' },
          { xmlName: 'Report', inFolder: true },
        ))
        connection.metadata.describeValueType.mockImplementation(
          async (typeName: string) => {
            if (typeName.endsWith('Test1')) {
              throw new Error('fake error')
            }
            if (typeName.endsWith('Report')) {
              return mockDescribeValueResult({
                parentField: {
                  name: '',
                  soapType: 'string',
                  foreignKeyDomain: 'ReportFolder',
                },
                valueTypeFields: [],
              })
            }
            return mockDescribeValueResult({ valueTypeFields: [] })
          }
        )
        connection.metadata.list.mockImplementation(
          async inQuery => {
            const query = collections.array.makeArray(inQuery)[0]
            if (_.isEqual(query, { type: 'Report', folder: 'skip' })) {
              throw new Error('fake error')
            }
            const fullName = query.type === 'ReportFolder'
              ? 'skip'
              : 'instance1'
            return [mockFileProperties({ fullName, type: query.type })]
          }
        )
        connection.metadata.read.mockImplementation(
          async (typeName: string, fullNames: string | string[]) => {
            if (typeName === 'Test2') {
              throw new Error('fake error')
            }
            return { fullName: Array.isArray(fullNames) ? fullNames[0] : fullNames }
          }
        )

        result = await adapter.fetch()
        elements = result.elements
      })

      it('should not consist config changes', () => {
        expect(result.updatedConfig).toBeUndefined()
      })

      it('should skip skippedlist types', () => {
        expect(findElements(elements, 'Test1')).toHaveLength(0)
        expect(findElements(elements, 'Test2')).toHaveLength(1)
        expect(findElements(elements, 'Test3')).toHaveLength(1)
      })

      it('should skip skippedlist instances', () => {
        expect(findElements(elements, 'Test2', 'instance1')).toHaveLength(0)
        expect(findElements(elements, 'Test3', 'instance1')).toHaveLength(1)
        expect(findElements(elements, 'Report', 'instance1')).toHaveLength(0)
      })
    })

    describe('should not fetch skippedlist retrieve instance', () => {
      let result: Element[] = []
      beforeEach(async () => {
        mockMetadataType(
          { xmlName: 'AssignmentRules' },
          { valueTypeFields: [] },
          [
            {
              props: { fullName: 'MyRules', fileName: 'assignmentRules/MyRules.rules' },
              values: { fullName: 'MyRules' },
              zipFiles: [
                {
                  path: 'unpackaged/assignmentRules/MyRules.rules',
                  content: `
<?xml version="1.0" encoding="UTF-8"?>
<AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata">
  <dummy>true</dummy>
</ApexPage>
`,
                },
              ],
            },
          ]
        )

        result = (await adapter.fetch()).elements
      })

      it('should skip skippedlist retrieve instances', () => {
        expect(findElements(result, 'EmailTemplate', 'MyFolder_MyEmailTemplateSkippedList'))
          .toHaveLength(0)
      })
    })

    describe('should return errors when fetch on certain instances failed', () => {
      class SFError extends Error {
        constructor(name: string, message?: string) {
          super(message)
          this.name = name
        }
      }
      let result: FetchResult
      let config: InstanceElement

      beforeEach(async () => {
        connection.describeGlobal.mockImplementation(async () => ({ sobjects: [] }))
        connection.metadata.describe.mockResolvedValue(mockDescribeResult(
          { xmlName: 'MetadataTest1' },
          { xmlName: 'MetadataTest2' },
          { xmlName: 'InstalledPackage' },
          { xmlName: 'Report', inFolder: true },
        ))
        connection.metadata.describeValueType.mockImplementation(
          async (typeName: string) => {
            if (typeName.endsWith('Report')) {
              return mockDescribeValueResult({
                parentField: {
                  name: '',
                  soapType: 'string',
                  foreignKeyDomain: 'ReportFolder',
                },
                valueTypeFields: [],
              })
            }
            return mockDescribeValueResult({ valueTypeFields: [] })
          }
        )
        connection.metadata.list.mockImplementation(
          async inQuery => {
            const query = collections.array.makeArray(inQuery)[0]
            const { type } = query
            if (type === 'MetadataTest2') {
              throw new SFError('sf:UNKNOWN_EXCEPTION')
            }
            if (_.isEqual(query, { type: 'Report', folder: 'testFolder' })) {
              throw new SFError('sf:UNKNOWN_EXCEPTION')
            }
            const fullNames: Record<string, string> = {
              MetadataTest1: 'instance1',
              InstalledPackage: 'instance2',
              ReportFolder: 'testFolder',
            }
            const fullName = fullNames[type]
            return fullName === undefined ? [] : [mockFileProperties({ fullName, type })]
          }
        )
        connection.metadata.read.mockRejectedValue(new SFError('sf:UNKNOWN_EXCEPTION'))

        connection.metadata.retrieve.mockReturnValue(mockRetrieveResult({
          messages: [{
            fileName: 'unpackaged/package.xml',
            problem: 'Metadata API received improper input.'
              + 'Please ensure file name and capitalization is correct.'
              + 'Load of metadata from db failed for metadata of '
              + 'type:InstalledPackage and file name:Test2.',
          }],
        }))

        result = await adapter.fetch()
        config = result?.updatedConfig?.config as InstanceElement
      })

      it('should return config upon errors', () => {
        expect(config).toBeDefined()
      })

      it('should return correct config', () => {
        expect(config.value).toEqual(
          {
            [INSTANCES_REGEX_SKIPPED_LIST]: [
              '^Report.testFolder$',
              '^InstalledPackage.Test2$',
              '^MetadataTest1.instance1$',
            ]
              .concat(testInstancesRegexSkippedList),
            [METADATA_TYPES_SKIPPED_LIST]: ['MetadataTest2']
              .concat(testMetadataTypesSkippedList),
            [MAX_CONCURRENT_RETRIEVE_REQUESTS]: testMaxConcurrentRetrieveRequests,
            [MAX_ITEMS_IN_RETRIEVE_REQUEST]: testMaxItemsInRetrieveRequest,
            [HIDE_TYPES_IN_NACLS]: testHideTypesInNacls,
          }
        )
      })
    })
  })
})
