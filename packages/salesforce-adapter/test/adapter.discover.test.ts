/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ObjectType, InstanceElement, ServiceIds, ElemID, BuiltinTypes, FetchOptions,
  Element, CORE_ANNOTATIONS, FetchResult, isListType, ListType, getRestriction, isServiceId,
} from '@salto-io/adapter-api'
import { MetadataInfo } from 'jsforce'
import { values, collections } from '@salto-io/lowerdash'
import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from 'jsforce-types'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/jsforce'
import { apiName, Types } from '../src/transformers/transformer'
import { findElements, ZipFile } from './utils'
import mockAdapter from './adapter'
import * as constants from '../src/constants'
import { LAYOUT_TYPE_ID } from '../src/filters/layouts'
import {
  MockFilePropertiesInput, MockDescribeResultInput, MockDescribeValueResultInput,
  mockDescribeResult, mockDescribeValueResult, mockFileProperties, mockRetrieveLocator,
} from './connection'
import { FetchElements, MAX_ITEMS_IN_RETRIEVE_REQUEST } from '../src/types'
import { fetchMetadataInstances } from '../src/fetch'
import * as fetchModule from '../src/fetch'
import * as xmlTransformerModule from '../src/transformers/xml_transformer'
import * as metadataQueryModule from '../src/fetch_profile/metadata_query'
import { SALESFORCE_ERRORS, SOCKET_TIMEOUT } from '../src/constants'
import { isInstanceOfType } from '../src/filters/utils'
import { NON_TRANSIENT_SALESFORCE_ERRORS } from '../src/config_change'

const { makeArray } = collections.array
const { awu } = collections.asynciterable
const { INVALID_CROSS_REFERENCE_KEY } = SALESFORCE_ERRORS

describe('SalesforceAdapter fetch', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let fetchMetadataInstancesSpy: jest.SpyInstance

  class SFError extends Error {
    constructor(name: string, message?: string) {
      super(message)
      this.name = name
    }
  }

  const metadataExclude = [
    { metadataType: 'Test1' },
    { metadataType: 'Ignored1' },
    { metadataType: '.*Test2', name: 'instance1.*' },
    { name: '.*SkippedList' },
    { metadataType: 'ReportFolder', name: 'skip' },
    { metadataType: '.*AssignmentRules', name: 'MyRules.*' },
  ]

  const testMaxItemsInRetrieveRequest = 20

  const mockFetchOpts: MockInterface<FetchOptions> = {
    progressReporter: { reportProgress: jest.fn() },
  }

  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, name)

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
        config: {
          fetch: {
            metadata: {
              exclude: metadataExclude,
            },
          },
          maxItemsInRetrieveRequest: testMaxItemsInRetrieveRequest,
          client: {
            readMetadataChunkSize: { default: 3, overrides: { Test: 2 } },
          },
        },
      },
    }))
    fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
  })

  afterEach(() => {
    jest.resetAllMocks()
    jest.restoreAllMocks()
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
      chunkSize = testMaxItemsInRetrieveRequest,
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
          _.chunk(zipFiles, chunkSize).forEach(
            chunkFiles => connection.metadata.retrieve.mockReturnValueOnce(mockRetrieveLocator({
              zipFiles: _.flatten(chunkFiles),
            })),
          )
        }
      }
    }

    const mockMetadataTypes = (
      typeDefs: MockDescribeResultInput[],
      valueDef: MockDescribeValueResultInput,
      instancesByType: Record<string, MockInstanceParams[]>,
      chunkSize = testMaxItemsInRetrieveRequest,
    ): void => {
      connection.metadata.describe.mockResolvedValue(
        mockDescribeResult(...typeDefs)
      )
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult(valueDef)
      )
      connection.metadata.list.mockImplementation(async queries => {
        const { type } = makeArray(queries)[0]
        return instancesByType[type]?.map(inst => mockFileProperties({ type, ...inst.props }))
      })
      connection.metadata.read.mockImplementation(async type => instancesByType[type].map(inst => inst.values))
      const zipFiles = _.flatten(Object.values(instancesByType)).map(inst => inst.zipFiles).filter(values.isDefined)
      if (!_.isEmpty(zipFiles)) {
        _.chunk(zipFiles, chunkSize).forEach(
          chunkFiles => connection.metadata.retrieve.mockReturnValueOnce(mockRetrieveLocator({
            zipFiles: _.flatten(chunkFiles),
          })),
        )
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
      const { elements: result } = await adapter.fetch(mockFetchOpts)

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Flow')
      const flow = findElements(result, 'Flow').pop() as ObjectType
      expect(flow.fields.description.refType.elemID.name).toBe('string')
      // TODO: remove comment when SALTO-45 will be resolved
      // expect(flow.fields.description.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
      expect(flow.fields.isTemplate.refType.elemID.name).toBe('boolean')
      expect(flow.fields.isTemplate.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
      expect(flow.fields.enum.refType.elemID.name).toBe('string')
      expect(flow.fields.enum.annotations[CORE_ANNOTATIONS.DEFAULT]).toBe('yes')
      // Note the order here is important because we expect restriction values to be sorted
      expect(getRestriction(flow.fields.enum).values).toEqual(['no', 'yes'])
      expect(flow.path).toEqual([constants.SALESFORCE, constants.TYPES_PATH, 'Flow'])
      expect(isServiceId(await flow.fields[constants.INSTANCE_FULL_NAME_FIELD].getType()))
        .toEqual(true)
      expect(isServiceId((await flow.getAnnotationTypes())[constants.METADATA_TYPE]))
        .toEqual(true)
      expect(flow.annotations[constants.METADATA_TYPE]).toEqual('Flow')
    })

    it('should fetch folder metadata type', async () => {
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
        }
      )
      const { elements: result } = await adapter.fetch(mockFetchOpts)

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}EmailTemplate')
      expect(describeMock.mock.calls[1][0]).toBe('{http://soap.sforce.com/2006/04/metadata}EmailFolder')
      const emailFolder = findElements(result, 'EmailFolder').pop() as ObjectType
      expect(emailFolder.fields[constants.INTERNAL_ID_FIELD]).toBeDefined()
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

      const { elements: result } = await adapter.fetch(mockFetchOpts)

      const elementNames = result.map(x => x.elemID.getFullName())
      expect(elementNames).toHaveLength(_.concat(
        Object.keys(Types.getAllFieldTypes()),
        Object.keys(Types.getAllMissingTypes()),
      ).length
        + 2 /* LookupFilter & filter items */
        + 1 /* rollup summary operation */
        + 1 /* rollup summary filter type */
        + 1 /* rollup summary filter's operation type */
        + 3
        + 2 /* mask char & type */
        + 1 /* security classification */
        + 1 /* business status */
        + 1 /* treat blank as */
        + 1 /* value set */
        + 2 /* field dependency & value settings */
        + 7 /* range restrictions */)

      const elementsMap = _.keyBy(result, element => element.elemID.getFullName())
      const nestingType = elementsMap['salesforce.NestingType'] as ObjectType
      const nestedType = elementsMap['salesforce.NestedType'] as ObjectType
      const singleField = elementsMap['salesforce.SingleFieldType'] as ObjectType
      expect(nestingType).toBeInstanceOf(ObjectType)
      expect(nestingType.fields.field.refType.elemID).toEqual(nestedType.elemID)
      expect(nestingType.fields.otherField.refType.elemID).toEqual(singleField.elemID)
      expect(nestedType).toBeInstanceOf(ObjectType)
      expect(nestedType.fields.nestedStr.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
      expect(nestedType.fields.nestedNum.refType.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
      expect(nestedType.fields.doubleNested.refType.elemID).toEqual(singleField.elemID)
      expect(singleField).toBeInstanceOf(ObjectType)
      expect(singleField.fields.str.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
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
            {
              props: {
                fullName: 'IgnoredNamespace__FlowInstance',
                fileName: 'flows/IgnoredNamespace__FlowInstance.flow',
                namespacePrefix: 'IgnoredNamespace',
              },
              values: {
                fullName: 'IgnoredNamespace__FlowInstance',
                bla: { bla: '55', bla2: 'false', bla3: 'true' },
              },
            },
          ]
        )
      }

      it('should fetch metadata instance', async () => {
        mockFlowType()
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(result, 'Flow', 'FlowInstance').pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
        expect(flow.value.bla.bla).toBe(55)
        expect(flow.value.bla.bla2).toBe(false)
        expect(flow.value.bla.bla3).toBe(true)
      })

      it('should add author annotations to metadata instance', async () => {
        mockFlowType()
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(result, 'Flow', 'FlowInstance').pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
        expect(flow.annotations[CORE_ANNOTATIONS.CREATED_BY]).toEqual('test')
        expect(flow.annotations[CORE_ANNOTATIONS.CREATED_AT]).toEqual('2020-05-01T14:31:36.000Z')
        expect(flow.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual('test')
        expect(flow.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('2020-05-01T14:41:36.000Z')
      })

      it('should not fetch excluded namespaces', async () => {
        const {
          connection: connectionMock,
          client: clientMock,
          adapter: adapterMock,
        } = mockAdapter({
          adapterParams: {
            config: {
              fetch: {
                metadata: {
                  exclude: [
                    { namespace: 'IgnoredNamespace' },
                  ],
                },
              },
            },
          },
        })
        connection = connectionMock
        mockFlowType()
        const spyReadMetadata = jest.spyOn(clientMock, 'readMetadata')
        await adapterMock.fetch(mockFetchOpts)
        expect(spyReadMetadata).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['IgnoredNamespace__FlowInstance'])
        )
        expect(spyReadMetadata).not.toHaveBeenCalledWith(
          expect.any(String),
          'IgnoredNamespace__FlowInstance'
        )
      })

      it('should not fetch metadata types instances the will be fetch in filters', async () => {
        const instances = [
          { props: { fullName: 'MyType0' }, values: { fullName: 'MyType0' } },
          { props: { fullName: 'MyType1' }, values: { fullName: 'MyType1' } },
        ]
        mockMetadataType(
          { xmlName: 'Queue' },
          { valueTypeFields: [{ name: 'fullName', soapType: 'string', valueRequired: true }] },
          instances,
        )
        await adapter.fetch(mockFetchOpts)
        expect(fetchMetadataInstancesSpy).not.toHaveBeenCalledWith(expect.objectContaining(
          { metadataType: expect.objectContaining(
            { elemID: expect.objectContaining(
              { typeName: 'Queue' }
            ) }
          ) }
        ))
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

        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const flow = findElements(result, 'Flow', 'my_FlowInstance').pop() as InstanceElement
        expect((await flow.getType()).elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
        expect(flow.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('FlowInstance')
      })

      it('should use default configured chunk size', async () => {
        const chunkSize = 3
        const type = 'MyType'
        const instances = [
          { props: { fullName: 'MyType0' }, values: { fullName: 'MyType0' } },
          { props: { fullName: 'MyType1' }, values: { fullName: 'MyType1' } },
          { props: { fullName: 'MyType2' }, values: { fullName: 'MyType2' } },
          { props: { fullName: 'MyType3' }, values: { fullName: 'MyType3' } },
        ]
        mockMetadataType(
          { xmlName: 'MyType' },
          { valueTypeFields: [{ name: 'fullName', soapType: 'string', valueRequired: true }] },
          instances,
        )
        const res = await adapter.fetch(mockFetchOpts)
        expect(res).toBeDefined()
        expect(connection.metadata.read)
          .toHaveBeenNthCalledWith(
            1,
            type,
            instances.slice(0, chunkSize).map(e => e.values.fullName),
          )
        expect(connection.metadata.read)
          .toHaveBeenNthCalledWith(
            2,
            type,
            instances.slice(chunkSize).map(e => e.values.fullName),
          )
      })
      it('should use overrided configured chunk size', async () => {
        const chunkSize = 2
        const type = 'Test'
        const instances = [
          { props: { fullName: 'Test0' }, values: { fullName: 'Test0' } },
          { props: { fullName: 'Test1' }, values: { fullName: 'Test1' } },
          { props: { fullName: 'Test2' }, values: { fullName: 'Test2' } },
          { props: { fullName: 'Test3' }, values: { fullName: 'Test3' } },
        ]
        mockMetadataType(
          { xmlName: 'Test' },
          { valueTypeFields: [{ name: 'fullName', soapType: 'string', valueRequired: true }] },
          instances,
        )
        const res = await adapter.fetch(mockFetchOpts)
        expect(res).toBeDefined()
        expect(connection.metadata.read)
          .toHaveBeenNthCalledWith(
            1, type, instances.slice(0, chunkSize).map(e => e.values.fullName)
          )
        expect(connection.metadata.read)
          .toHaveBeenNthCalledWith(
            2, type, instances.slice(chunkSize).map(e => e.values.fullName)
          )
      })
    })

    describe('with complicated metadata instance', () => {
      const LAYOUT_NAME = 'Order-Order Layout'
      const INSTALLED_PACKAGE_NAMESPACE_PREFIX = 'SBQQ'
      const INSTALLED_PACKAGE_LAYOUT_NAME = 'SBQQ__SearchFilter__c-SearchFilter Layout'

      let fromRetrieveResultSpy: jest.SpyInstance

      const createLayoutInstance = (layoutName: string, namespacePrefix?: string): MockInstanceParams => ({
        props: {
          fullName: layoutName,
          fileName: `layouts/${layoutName}.layout`,
          namespacePrefix,
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
      })

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
            createLayoutInstance(LAYOUT_NAME),
            createLayoutInstance(INSTALLED_PACKAGE_LAYOUT_NAME, INSTALLED_PACKAGE_NAMESPACE_PREFIX),
          ],
        )
        fromRetrieveResultSpy = jest.spyOn(xmlTransformerModule, 'fromRetrieveResult')
        fromRetrieveResultSpy.mockResolvedValue([
          {
            file: mockFileProperties({
              type: 'Layout',
              fullName: LAYOUT_NAME,
              fileName: `layouts/${LAYOUT_NAME}.layout`,
            }),
            values: {
              fullName: LAYOUT_NAME,
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
        ],)
      })

      it('should fetch complicated metadata instance', async () => {
        const { elements: result } = await adapter.fetch(mockFetchOpts)
        const layout = findElements(result, 'Layout', 'Order_Order_Layout@bs').pop() as InstanceElement
        expect(layout).toBeDefined()
        expect((await layout.getType()).elemID).toEqual(LAYOUT_TYPE_ID)
        expect(layout.value[constants.INSTANCE_FULL_NAME_FIELD]).toBe(LAYOUT_NAME)
        expect(layout.value.layoutSections.length).toBe(4)
        expect(layout.value.layoutSections[0].label).toBe('Description Information')
        expect(layout.value.layoutSections[0].layoutColumns[0].layoutItems[0].behavior).toBe('Edit')
        expect(layout.value.layoutSections[0].layoutColumns[1].layoutItems[0].field).toBe('Description2')
        expect(layout.value.layoutSections[1].label).toBe('Additional Information')
        expect(layout.value.layoutSections[2].style).toBe('CustomLinks')
        expect(
          (await (await (await layout.getType()).fields.processMetadataValues.getType() as ListType)
            .getInnerType() as ObjectType).fields.name.refType.elemID.name
        ).toBe('string')
        expect(layout.value.processMetadataValues[1].name).toBe('leftHandSideReferenceTo')
        // empty objects should be omitted
        expect(layout.value.processMetadataValues[2].name).toBe('leftHandSideReferenceTo2')
        // empty strings should be kept
        expect(layout.value.processMetadataValues[2].value).toEqual({ stringValue: '' })
        expect(layout.value.processMetadataValues[3].name).toBe('leftHandSideReferenceTo3')
        // nulls should be omitted
        expect(layout.value.processMetadataValues[3].value).toBeUndefined()

        // Validates `fromRetrieveResult` is called with correct file properties.
        expect(fromRetrieveResultSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            expect.objectContaining({ fileName: 'layouts/Order-Order Layout.layout', fullName: 'Order-Order Layout' }),
            expect.objectContaining({ fileName: 'layouts/SBQQ__SearchFilter__c-SBQQ__SearchFilter Layout.layout', fullName: 'SBQQ__SearchFilter__c-SBQQ__SearchFilter Layout' }),
          ]),
          expect.anything(),
          expect.anything(),
        )
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

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const flow = findElements(result, 'Flow', 'FlowInstance').pop() as InstanceElement
      expect((await flow.getType()).elemID).toEqual(new ElemID(constants.SALESFORCE, 'Flow'))
      expect(isListType(await ((await flow.getType())).fields.listTest.getType())).toBeTruthy()

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

      await adapter.fetch(mockFetchOpts)

      expect(connection.metadata.read).toHaveBeenCalledWith('QuoteSettings', ['Quote'])
    })

    it('should not fetch child metadata type', async () => {
      mockMetadataType(
        { xmlName: 'Base', childXmlNames: ['Child'] },
        { valueTypeFields: [] },
      )
      await adapter.fetch(mockFetchOpts)

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
  <apiVersion>50.0</apiVersion>
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
      const { elements: result } = await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(2)
      const [first] = findElements(result, 'ApexClass', 'MyClass0') as InstanceElement[]
      const [second] = findElements(result, 'ApexClass', 'MyClass1') as InstanceElement[]
      expect(first.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyClass0')
      expect(second.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('MyClass1')
      expect((await first.value.content.getContent()).toString().includes('Instance0')).toBeTruthy()
      expect((await second.value.content.getContent()).toString().includes('Instance1')).toBeTruthy()
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

      const { elements: result } = await adapter.fetch(mockFetchOpts)
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

      const { elements: result } = await adapter.fetch(mockFetchOpts)
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
            props: { fullName: 'asd__Test', namespacePrefix: namespaceName },
            values: { fullName: `${namespaceName}__Test` },
          },
        ]
      )

      const { elements: result } = await adapter.fetch(mockFetchOpts)
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

      const { elements: result } = await adapter.fetch(mockFetchOpts)
      const [testInst] = findElements(result, 'Test', 'asd__Test')
      expect(testInst).toBeDefined()
      expect(testInst.path).toEqual(
        [constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH, namespaceName,
          constants.RECORDS_PATH, 'Test', 'asd__Test']
      )
    })

    it('should not fail the fetch on instances too large', async () => {
      mockMetadataType(
        { xmlName: 'ApexClass', metaFile: true, suffix: 'cls', directoryName: 'classes' },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'content', soapType: 'string', valueRequired: false },
          ],
        },
        [
          {
            props: { fullName: 'LargeClass', fileName: 'classes/LargeClass.cls' },
            values: { fullName: 'LargeClass' },
            zipFiles: [
              {
                path: 'unpackaged/classes/LargeClass.cls-meta.xml',
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>50.0</apiVersion>
  <status>Active</status>
</ApexClass>
`,
              },
              {
                path: 'unpackaged/classes/LargeClass.cls',
                content: `
public class LargeClass} {
  public void printLog() {
    System.debug('LargeInstance');
  }'
}
`,
              },
            ],
          },
        ]
      )

      connection.metadata.retrieve.mockReset()
      connection.metadata.retrieve.mockReturnValue(mockRetrieveLocator({
        errorStatusCode: constants.RETRIEVE_SIZE_LIMIT_ERROR,
      }))

      const { elements: result, updatedConfig: config } = await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(1)
      expect(findElements(result, 'ApexClass', 'LargeClass')).toBeEmpty()
      expect(config?.config[0]?.value.fetch.metadata.exclude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metadataType: 'ApexClass',
            name: 'LargeClass',
          }),
        ])
      )
    })

    it('should retry fetch with smaller batches if zip file is too large', async () => {
      connection.metadata.retrieve.mockReturnValueOnce(mockRetrieveLocator({
        errorStatusCode: constants.RETRIEVE_SIZE_LIMIT_ERROR,
      }))

      mockMetadataType(
        { xmlName: 'ApexClass', metaFile: true, suffix: 'cls', directoryName: 'classes' },
        {
          valueTypeFields: [
            { name: 'fullName', soapType: 'string', valueRequired: true },
            { name: 'content', soapType: 'string', valueRequired: false },
          ],
        },
        _.times(2).map(
          index => ({
            props: { fullName: `LargeClass${index}`, fileName: `classes/LargeClass${index}.cls` },
            values: { fullName: 'LargeClass' },
            zipFiles: [
              {
                path: `unpackaged/classes/LargeClass${index}.cls-meta.xml`,
                content: `
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>50.0</apiVersion>
  <status>Active</status>
</ApexClass>
`,
              },
              {
                path: `unpackaged/classes/LargeClass${index}.cls`,
                content: `
public class LargeClass${index} {
  public void printLog() {
    System.debug('LargeClass${index}');
  }'
}
`,
              },
            ],
          })
        ),
        1
      )

      const { elements: result, updatedConfig: config } = await adapter.fetch(mockFetchOpts)
      expect(connection.metadata.retrieve).toHaveBeenCalledTimes(3)
      const [first] = findElements(result, 'ApexClass', 'LargeClass0') as InstanceElement[]
      const [second] = findElements(result, 'ApexClass', 'LargeClass1') as InstanceElement[]
      expect(first.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('LargeClass0')
      expect(second.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual('LargeClass1')
      expect(config?.config[0]?.value.fetch.metadata.exclude).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metadataType: 'ApexClass',
          }),
        ])
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

        result = await adapter.fetch(mockFetchOpts)
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

        result = (await adapter.fetch(mockFetchOpts)).elements
      })

      it('should skip skippedlist retrieve instances', () => {
        expect(findElements(result, 'EmailTemplate', 'MyFolder_MyEmailTemplateSkippedList'))
          .toHaveLength(0)
      })
    })

    describe('should return errors when fetch on certain instances failed', () => {
      let result: FetchResult
      let config: InstanceElement

      const mockFailures = (connectionMock: MockInterface<Connection>): void => {
        connectionMock.describeGlobal.mockImplementation(async () => ({ sobjects: [] }))
        connectionMock.metadata.describe.mockResolvedValue(mockDescribeResult(
          { xmlName: 'MetadataTest1' },
          { xmlName: 'MetadataTest2' },
          { xmlName: 'InstalledPackage' },
          { xmlName: 'Report', inFolder: true },
        ))
        connectionMock.metadata.describeValueType.mockImplementation(
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
        connectionMock.metadata.list.mockImplementation(
          async inQuery => {
            const query = collections.array.makeArray(inQuery)[0]
            const { type } = query
            if (type === 'MetadataTest2') {
              throw new SFError('sf:UNKNOWN_EXCEPTION')
            }
            const fullNames: Record<string, string> = {
              MetadataTest1: 'instance1',
              InstalledPackage: 'instance2',
            }
            const fullName = fullNames[type]
            return fullName === undefined ? [] : [mockFileProperties({ fullName, type })]
          }
        )
        connectionMock.metadata.read.mockRejectedValue(new SFError('sf:UNKNOWN_EXCEPTION'))

        connectionMock.metadata.retrieve.mockReturnValue(mockRetrieveLocator({
          messages: [{
            fileName: 'unpackaged/package.xml',
            problem: 'Metadata API received improper input.'
              + 'Please ensure file name and capitalization is correct.'
              + 'Load of metadata from db failed for metadata of '
              + 'type:InstalledPackage and file name:Test2.',
          }],
        }))
      }

      it('should return correct config when orig config has values', async () => {
        mockFailures(connection)
        result = await adapter.fetch(mockFetchOpts)
        config = result?.updatedConfig?.config[0] as InstanceElement
        expect(config).toBeDefined()
        expect(config.value).toEqual(
          {
            fetch: {
              metadata: {
                exclude: [
                  ...metadataExclude,
                  { metadataType: 'InstalledPackage', name: 'Test2' },
                  { metadataType: 'MetadataTest1', name: 'instance1' },
                  { metadataType: 'MetadataTest2' },
                ],
              },
            },
            client: {
              readMetadataChunkSize: {
                default: 3,
                overrides: { Test: 2 },
              },
            },
            [MAX_ITEMS_IN_RETRIEVE_REQUEST]: testMaxItemsInRetrieveRequest,
          }
        )
      })
      it('should return correct config when original config is empty', async () => {
        const { connection: connectionMock, adapter: adapterMock } = mockAdapter({
          adapterParams: {
            getElemIdFunc: mockGetElemIdFunc,
            config: {},
          },
        })
        mockFailures(connectionMock)

        result = await adapterMock.fetch(mockFetchOpts)
        config = result?.updatedConfig?.config[0] as InstanceElement
        expect(config.value).toEqual(
          {
            fetch: {
              metadata: {
                exclude: [
                  { metadataType: 'InstalledPackage', name: 'Test2' },
                  { metadataType: 'MetadataTest1', name: 'instance1' },
                  { metadataType: 'MetadataTest2' },
                ],
              },
            },
          }
        )
      })
    })
    describe('with types with more than maxInstancesPerType instances', () => {
      const metadataType = {
        annotations: { apiName: 'test' },
        elemID: {
          name: 'test',
          createNestedID: jest.fn(),
          getFullName: jest.fn(),
          isTopLevel: jest.fn(),
        },
      } as unknown as ObjectType
      const metadataQuery = {
        isTypeMatch: jest.fn(),
        isInstanceMatch: jest.fn(),
        isPartialFetch: jest.fn(),
        getFolderPathsByName: jest.fn(),
      }
      const excludeFilePropMock = mockFileProperties({ fullName: 'fullName', type: 'excludeMe' })
      const includeFilePropMock = mockFileProperties({ fullName: 'fullName', type: 'includeMe' })

      const MOCK_METADATA_LENGTH = 5
      const { client } = mockAdapter()

      const fetchResult = (fileProps: FileProperties[], maxInstancesPerType: number)
          : Promise<FetchElements<InstanceElement[]>> =>
        fetchMetadataInstances({
          client,
          metadataType,
          metadataQuery,
          fileProps,
          maxInstancesPerType,
        })

      beforeAll(() => {
        client.readMetadata = jest.fn().mockResolvedValue({
          result: new Array(MOCK_METADATA_LENGTH).fill(includeFilePropMock),
          errors: [],
          configSuggestions: [],
        })
        metadataType.elemID.isTopLevel = jest.fn().mockReturnValue(true)
      })

      it('should not fetch the types with many instances and add them to the exclude list', async () => {
        const excludeFilePropMocks = new Array(3).fill(excludeFilePropMock)
        const includeFilePropMocks = new Array(2).fill(includeFilePropMock)

        const excludeFetchResult = await fetchResult(excludeFilePropMocks, 2)
        const includeFetchResult = await fetchResult(includeFilePropMocks, 2)

        expect(excludeFetchResult.elements.length).toBe(0)
        expect(excludeFetchResult.configChanges.length).toBe(1)
        expect(excludeFetchResult.configChanges[0]).toMatchObject({
          type: 'metadataExclude',
          value: {
            metadataType: 'excludeMe',
          },
          reason: "'excludeMe' has 3 instances so it was skipped and would be excluded from future fetch operations, as maxInstancesPerType is set to 2.\n      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (-1 for unlimited).",
        })

        // Make sure the api call was sent and that nothing was added to exclude
        expect(includeFetchResult.elements.length).toBe(MOCK_METADATA_LENGTH)
        expect(includeFetchResult.configChanges.length).toBe(0)
      })
    })

    describe('with InFolderMetadataType instance', () => {
      let toRetrieveRequestSpy: jest.SpyInstance

      beforeEach(async () => {
        toRetrieveRequestSpy = jest.spyOn(xmlTransformerModule, 'toRetrieveRequest')
        const actualMetadataQuery = jest.requireActual('../src/fetch_profile/metadata_query')
        jest.spyOn(metadataQueryModule, 'buildMetadataQuery').mockReturnValue({
          ...actualMetadataQuery,
          buildMetadataQuery: jest.fn().mockImplementation(args => ({
            ...actualMetadataQuery.buildMetadataQuery(args),
            getFolderPathsByName: jest.fn().mockReturnValue({
              ReportsFolder: 'ReportsFolder',
              NestedFolder: 'ReportsFolder/NestedFolder',
            }),
          })),
        })

        mockMetadataTypes(
          [
            { xmlName: 'Report', directoryName: 'reports' },
            { xmlName: 'ReportFolder', directoryName: 'reports' },
          ],

          {
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          {
            Report: [
              {
                props: {
                  fullName: 'TestReport',
                  fileName: 'reports/ReportsFolder/TestReport.report',
                },
                values: {
                  fullName: 'ReportsFolder/TestReport',
                },
              },
              {
                props: {
                  fullName: 'TestNestedReport',
                  fileName: 'reports/ReportsFolder/NestedFolder/TestNestedReport.report',
                },
                values: {
                  fullName: 'NestedFolder/TestNestedReport',
                },
              },
            ],
            ReportFolder: [
              {
                props: {
                  fullName: 'ReportsFolder',
                  fileName: 'reports/ReportsFolder',
                },
                values: {
                  fullName: 'ReportsFolder',
                },
              },
              {
                props: {
                  fullName: 'NestedFolder',
                  fileName: 'reports/ReportsFolder/NestedFolder',
                },
                values: {
                  fullName: 'NestedFolder',
                },
              },
            ],
          },
        )
        await adapter.fetch(mockFetchOpts)
      })
      it('should fetch instances of both the FolderMetadataType and InFolderMetadataType', () => {
        expect(toRetrieveRequestSpy).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({ fileName: 'reports/ReportsFolder/TestReport.report', fullName: 'TestReport', type: 'Report' }),
          expect.objectContaining({ fileName: 'reports/ReportsFolder/NestedFolder/TestNestedReport.report', fullName: 'TestNestedReport', type: 'Report' }),
          expect.objectContaining({ fileName: 'reports/ReportsFolder', fullName: 'ReportsFolder', type: 'ReportFolder' }),
          expect.objectContaining({ fileName: 'reports/ReportsFolder/NestedFolder', fullName: 'NestedFolder', type: 'ReportFolder' }),
        ]))
      })
    })

    describe('with error that creates config suggestions', () => {
      const ROLE_INSTANCE_NAMES = [
        'CEO',
        'JiraAdmin',
      ]
      const FAILING_ROLE_INSTANCE_NAMES = [
        'SalesforceAdmin',
        'ProductManager',
      ]
      beforeEach(() => {
        mockMetadataType(
          { xmlName: 'Role', directoryName: 'roles' },
          {
            valueTypeFields: [
              {
                name: 'fullName',
                soapType: 'string',
              },
            ],
          },
          [
            {
              props: {
                fullName: 'CEO',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'CEO',
              },
            },
            {
              props: {
                fullName: 'JiraAdmin',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'JiraAdmin',
              },
            },
            {
              props: {
                fullName: 'SalesforceAdmin',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'SalesforceAdmin',
              },
            },
            {
              props: {
                fullName: 'ProductManager',
                fileName: 'roles/CEO.role',
              },
              values: {
                fullName: 'ProductManager',
              },
            },
          ]
        )
      })
      describe.each([
        new Error(SOCKET_TIMEOUT),
        Object.assign(new Error(INVALID_CROSS_REFERENCE_KEY), { errorCode: INVALID_CROSS_REFERENCE_KEY }),
        ...NON_TRANSIENT_SALESFORCE_ERRORS.map(errorName => new SFError(errorName)),
      ])('when client throws %p', thrownError => {
        beforeEach(() => {
          connection.metadata.read.mockImplementation(async (_typeName, fullNames) => {
            const names = makeArray(fullNames)
            const [instanceName] = names
            if (names.length > 1) {
              throw thrownError
            }
            if (FAILING_ROLE_INSTANCE_NAMES.includes(instanceName)) {
              throw thrownError
            }
            return {
              fullName: instanceName,
            }
          })
        })
        it('should create config suggestions for instances that failed', async () => {
          const fetchResult = await adapter.fetch(mockFetchOpts)
          const expectedMetadataExcludes = FAILING_ROLE_INSTANCE_NAMES
            .map(instanceName => expect.objectContaining({ metadataType: 'Role', name: instanceName }))
          expect(fetchResult?.updatedConfig?.config[0].value.fetch.metadata.exclude)
            .toEqual(expect.arrayContaining(expectedMetadataExcludes))
          const fetchedInstancesNames = await awu(fetchResult.elements)
            .filter(isInstanceOfType('Role'))
            .map(instance => apiName(instance))
            .toArray()
          expect(fetchedInstancesNames).toEqual(ROLE_INSTANCE_NAMES)
        })
      })
    })
  })
})
