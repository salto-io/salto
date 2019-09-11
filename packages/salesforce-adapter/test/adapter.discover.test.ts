import _ from 'lodash'
import {
  ObjectType, Type, InstanceElement,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/connection'
import * as constants from '../src/constants'
import { Types } from '../src/transformer'
import mockAdpater from './adapter'

describe('SalesforceAdapter discover', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  beforeEach(() => {
    ({ connection, adapter } = mockAdpater({
      adapterParams: {
        metadataAdditionalTypes: [],
      },
    }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('should discover SObjects', () => {
    const mockSingleSObject = (
      name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[],
      isMetadataType = false,
      isInCustomObjectList = true,
      custom = false,
    ): void => {
      connection.describeGlobal = jest.fn()
        .mockImplementation(async () => ({ sobjects: [{ name }] }))

      connection.soap.describeSObjects = jest.fn()
        .mockImplementation(async () => [{ name, custom, fields }])

      connection.metadata.describe = jest.fn()
        .mockImplementation(async () => ({
          metadataObjects: [
            constants.CUSTOM_OBJECT, ...(isMetadataType ? [name] : []),
          ].map(xmlName => ({ xmlName })),
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: [] }))

      connection.metadata.list = jest.fn()
        .mockImplementation(async ({ type }) => (
          (type === constants.CUSTOM_OBJECT && isInCustomObjectList) ? [{ fullName: name }] : []
        ))
    }

    it('should discover sobject with primitive types, validate type, label, required and default annotations', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'LastName',
          type: 'text',
          label: 'Last Name',
          nillable: false,
          defaultValue: {
            $: { 'xsi:type': 'xsd:string' },
            _: 'BLABLA',
          },
        },
        {
          name: 'FirstName',
          type: 'text',
          label: 'First Name',
          nillable: true,
        },
        {
          name: 'IsDeleted',
          type: 'boolean',
          label: 'Is Deleted',
          // Default values don't look like this in the API but we support it so we must test it
          defaultValue: false,
        },
        {
          name: 'Custom__c',
          type: 'boolean',
          label: 'Custom Field',
          nillable: true,
          defaultValue: {
            $: { 'xsi:type': 'xsd:boolean' },
            _: 'false',
          },
        },
        {
          name: 'Formula__c',
          type: 'text',
          label: 'Dummy formula',
          calculated: true,
          calculatedFormula: 'my formula',
        },
      ])
      const result = await adapter.discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.last_name.type.elemID.name).toBe('text')
      expect(lead.fields.last_name.annotationValues.label).toBe('Last Name')
      // Test Rquired true and false
      expect(lead.fields.last_name.annotationValues[Type.REQUIRED]).toBe(true)
      expect(lead.fields.first_name.annotationValues[Type.REQUIRED]).toBe(false)
      // Default string and boolean
      expect(lead.fields.last_name.annotationValues[Type.DEFAULT]).toBe('BLABLA')
      expect(lead.fields.is_deleted.annotationValues[Type.DEFAULT]).toBe(false)
      // Custom type
      expect(lead.fields.custom).not.toBeUndefined()
      expect(lead.fields.custom.annotationValues[constants.API_NAME]).toBe('Custom__c')
      expect(lead.fields.custom.annotationValues[Type.DEFAULT]).toBe(false)
      // Formula field
      expect(lead.fields.formula).toBeDefined()
      expect(lead.fields.formula.type.elemID.name).toBe('formula_text')
      expect(lead.fields.formula.annotationValues[constants.FORMULA]).toBe('my formula')
    })

    it('should discover sobject with picklist field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'PrimaryC',
          type: 'picklist',
          label: 'Primary',
          nillable: false,
          picklistValues: [
            { value: 'No', defaultValue: false },
            { value: 'Yes', defaultValue: true },
          ],
          restrictedPicklist: true,
        },
      ])
      const result = await adapter.discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('picklist')
      expect(
        (lead.fields.primary_c.annotationValues.values as string[]).join(';')
      ).toBe('No;Yes')
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.primary_c.annotationValues._default).toBe('Yes')
      expect(
        lead.fields.primary_c.annotationValues[constants.RESTRICTED_PICKLIST]
      ).toBe(true)
    })

    it('should discover sobject with combobox field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'PrimaryC',
          type: 'combobox',
          label: 'Primary',
          nillable: false,
          picklistValues: [
            { value: 'No', defaultValue: false },
            { value: 'Yes', defaultValue: true },
          ],
        },
      ])
      const result = await adapter.discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('combobox')
      expect(
        (lead.fields.primary_c.annotationValues.values as string[]).join(';')
      ).toBe('No;Yes')
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.primary_c.annotationValues._default.length).toBe(1)
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.primary_c.annotationValues._default.pop()).toBe('Yes')
    })

    it('should discover sobject with number field', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'NumberField',
          type: 'number',
          label: 'Numero',
          nillable: true,
        },
      ])
      const result = await adapter.discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.number_field.type.elemID.name).toBe('number')
    })

    it('should discover sobject with various field types', async () => {
      mockSingleSObject('Lead', [
        {
          name: 'AutoNumber',
          type: 'string',
          label: 'AutoNumero',
          autoNumber: true,
        },
        {
          name: 'String',
          type: 'string',
          label: 'Stringo',
        },
        {
          name: 'Number',
          type: 'double',
          label: 'Numero',
        },
        {
          name: 'TextArea',
          type: 'textarea',
          label: 'Texto Areato',
          length: 255,
        },
        {
          name: 'LongTextArea',
          type: 'textarea',
          label: 'Longo Texto Areato',
          length: 280,
          extraTypeInfo: 'plaintextarea',
        },
        {
          name: 'RichTextArea',
          type: 'textarea',
          label: 'Richo Texto Areato',
          length: 280,
          extraTypeInfo: 'richtextarea',
        },
        {
          name: 'EncryptedString',
          type: 'encryptedstring',
          label: 'Encrypto Stringo',
        },
        {
          name: 'MultiPickList',
          type: 'multipicklist',
          label: 'Multo Picklisto',
          precision: 5,
          picklistValues: [
            { value: 'No', defaultValue: false },
            { value: 'Yes', defaultValue: true },
          ],
        },
      ])
      const result = await adapter.discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.auto_number.type.elemID.name).toBe('autonumber')
      expect(lead.fields.string.type.elemID.name).toBe('text')
      expect(lead.fields.number.type.elemID.name).toBe('number')
      expect(lead.fields.text_area.type.elemID.name).toBe('textarea')
      expect(lead.fields.long_text_area.type.elemID.name).toBe('longtextarea')
      expect(lead.fields.rich_text_area.type.elemID.name).toBe('richtextarea')
      expect(lead.fields.encrypted_string.type.elemID.name).toBe('encryptedtext')
      expect(lead.fields.multi_pick_list.type.elemID.name).toBe('multipicklist')
      expect(lead.fields.multi_pick_list
        .annotationValues[constants.FIELD_ANNOTATIONS.VISIBLE_LINES]).toBe(5)
    })

    it('should split customizations to different elements', async () => {
      mockSingleSObject('Test', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ])

      const result = await adapter.discover()

      const testElements = result.filter(o => o.elemID.name === 'test') as ObjectType[]
      expect(testElements).toHaveLength(2)
      const [test, testCustomizations] = testElements
      expect(test.path).toEqual(['objects', 'standard', 'test'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field).toBeUndefined()
      expect(testCustomizations.path).toEqual(['objects', 'custom', 'test'])
      expect(testCustomizations.fields.dummy).toBeUndefined()
      expect(testCustomizations.fields.custom_field).toBeDefined()
    })

    it('should place SObjects that are not custom objects in the types directory', async () => {
      mockSingleSObject('Test', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ], false, false)

      const result = await adapter.discover()

      const testElements = result.filter(o => o.elemID.name === 'test') as ObjectType[]
      expect(testElements).toHaveLength(1)
      const [test] = testElements
      expect(test.path).toEqual(['types', 'object', 'test'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field).toBeDefined()
    })

    it('should not split custom SObjects', async () => {
      mockSingleSObject('Test__c', [
        {
          name: 'dummy', label: 'dummy', type: 'string',
        },
        {
          name: 'CustomField__c', label: 'custom field', type: 'string', custom: true,
        },
      ], false, true, true)

      const result = await adapter.discover()

      const testElements = result.filter(o => o.elemID.name === 'test') as ObjectType[]
      // custom objects should not be split
      expect(testElements).toHaveLength(1)
      const [test] = testElements
      expect(test.path).toEqual(['objects', 'custom', 'test'])
      expect(test.fields.dummy).toBeDefined()
      expect(test.fields.custom_field).toBeDefined()
    })

    it('should not discover SObjects that conflict with metadata types', async () => {
      mockSingleSObject('Flow', [
        { name: 'dummy', label: 'dummy', type: 'string' },
      ], true)

      const result = await adapter.discover()

      const flow = result.filter(o => o.elemID.name === 'flow').pop() as ObjectType
      expect(flow).toBeDefined() // We do expect to get the metadata type here
      expect(Object.keys(flow.fields)).toHaveLength(0)
      expect(flow.path).toEqual(['types', 'flow'])
    })
  })

  describe('should discover metadata types', () => {
    const mockSingleMetadataType = (
      xmlName: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[],
    ): void => {
      connection.describeGlobal = jest.fn()
        .mockImplementation(async () => ({ sobjects: [] }))

      connection.metadata.describe = jest.fn()
        .mockImplementation(async () => ({
          metadataObjects: [{ xmlName }],
        }))

      connection.metadata.describeValueType = jest.fn()
        .mockImplementation(async () => ({ valueTypeFields: fields }))

      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [])
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSingleMetadataInstance = (name: string, data: Record<string, any>): void => {
      connection.metadata.list = jest.fn()
        .mockImplementation(async () => [{ fullName: name }])

      connection.metadata.read = jest.fn()
        .mockImplementation(async () => data)
    }

    it('should discover basic metadata type', async () => {
      mockSingleMetadataType('Flow', [
        {
          name: 'Description',
          soapType: 'string',
          valueRequired: true,
        },
        {
          name: 'IsTemplate',
          soapType: 'boolean',
          valueRequired: false,
        },
        {
          name: 'Enum',
          soapType: 'SomeEnumType',
          picklistValues: [
            { value: 'yes', defaultValue: true },
            { value: 'no', defaultValue: false },
          ],
        },
      ])
      const result = await adapter.discover()

      const describeMock = connection.metadata.describeValueType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe('{http://soap.sforce.com/2006/04/metadata}Flow')
      const flow = result.filter(o => o.elemID.name === 'flow').pop() as ObjectType
      expect(flow.fields.description.type.elemID.name).toBe('string')
      // TODO: remove comment when SALTO-45 will be resolved
      // expect(flow.fields.description.annotationValues[Type.REQUIRED]).toBe(true)
      expect(flow.fields.is_template.type.elemID.name).toBe('boolean')
      expect(flow.fields.is_template.annotationValues[Type.REQUIRED]).toBe(false)
      expect(flow.fields.enum.type.elemID.name).toBe('string')
      expect(flow.fields.enum.annotationValues[Type.DEFAULT]).toBe('yes')
      expect(flow.fields.enum.annotationValues[Type.RESTRICTION]).toEqual({
        values: ['yes', 'no'],
      })
      expect(flow.path).toEqual(['types', 'flow'])
    })
    it('should discover nested metadata types', async () => {
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

      const result = await adapter.discover()

      expect(result).toHaveLength(Object.keys(Types.salesforceDataTypes).length + 3)
      const types = _.assign({}, ...result.map(t => ({ [t.elemID.getFullName()]: t })))
      const nestingType = types.salesforce_nesting_type
      const nestedType = types.salesforce_nested_type
      const singleField = types.salesforce_single_field_type
      expect(nestingType).not.toBeUndefined()
      expect(nestingType.fields.field.type.elemID.name).toEqual('nested_type')
      expect(nestingType.fields.other_field.type.elemID.name).toEqual('single_field_type')
      expect(nestedType).not.toBeUndefined()
      expect(nestedType.fields.nested_str.type.elemID.name).toEqual('string')
      expect(nestedType.fields.nested_num.type.elemID.name).toEqual('number')
      expect(nestedType.fields.double_nested.type.elemID.name).toEqual('single_field_type')
      expect(singleField).not.toBeUndefined()
      expect(singleField.fields.str.type.elemID.name).toEqual('string')
    })

    it('should discover metadata instance', async () => {
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

      const result = await adapter.discover()
      const flow = result.filter(o => o.elemID.name === 'flow_flow_instance').pop() as InstanceElement
      expect(flow.type.elemID.getFullName()).toBe('salesforce_flow')
      expect(flow.elemID.getFullName()).toBe('salesforce_flow_flow_instance')
      expect(flow.value.bla.bla).toBe(55)
      expect(flow.value.bla.bla_2).toBe(false)
      expect(flow.value.bla.bla_3).toBe(true)
    })

    it('should discover complicated metadata instance', async () => {
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

      mockSingleMetadataInstance('OrderLayout', {
        fullName: 'Order-Order Layout',
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

      const result = await adapter.discover()
      const layout = result.filter(o => o.elemID.name === 'layout_order_order_layout').pop() as InstanceElement
      expect(layout.type.elemID.getFullName()).toBe('salesforce_layout')
      expect(layout.value.full_name).toBe('Order-Order Layout')
      expect(layout.value.layout_sections.length).toBe(3)
      expect(layout.value.layout_sections[0].label).toBe('Description Information')
      expect(layout.value.layout_sections[0].layout_columns[0].layout_items.behavior).toBe('Edit')
      expect(layout.value.layout_sections[0].layout_columns[1].layout_items.field).toBe('Description2')
      expect(layout.value.layout_sections[1].layout_columns).toBeUndefined()
      expect(layout.value.layout_sections[1].label).toBe('Additional Information')
      expect(layout.value.layout_sections[2].style).toBe('CustomLinks')
      expect(((layout.type as ObjectType).fields.process_metadata_values.type as ObjectType)
        .fields.name.type.elemID.name).toBe('string')
      expect(layout.value.process_metadata_values[1].name).toBe('leftHandSideReferenceTo')
      expect(layout.value.process_metadata_values[1].value).toBeUndefined()
      expect(layout.value.process_metadata_values[2].name).toBe('leftHandSideReferenceTo2')
      expect(layout.value.process_metadata_values[2].value).toBeUndefined()
      expect(layout.value.process_metadata_values[3].name).toBe('leftHandSideReferenceTo3')
      expect(layout.value.process_metadata_values[3].value.string_value).toBeNull()
    })

    it('should discover metadata types lists', async () => {
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

      const result = await adapter.discover()
      const flow = result.filter(o => o.elemID.name === 'flow_flow_instance').pop() as InstanceElement
      expect(flow.type.elemID.getFullName()).toBe('salesforce_flow')
      expect((flow.type as ObjectType).fields.list_test.isList).toBe(true)

      expect(flow.elemID.getFullName()).toBe('salesforce_flow_flow_instance')
      expect(flow.value.list_test[0].field).toEqual('Field1')
      expect(flow.value.list_test[0].editable).toBe(true)
      expect(flow.value.list_test[1].field).toEqual('Field2')
      expect(flow.value.list_test[1].editable).toBe(false)

      const flow2 = result.filter(o => o.elemID.name === 'flow_flow_instance_2').pop() as InstanceElement
      expect(flow2.value.list_test[0].field).toEqual('Field11')
      expect(flow2.value.list_test[0].editable).toBe(true)
    })

    it('should discover settings instance', async () => {
      mockSingleMetadataType('Settings', [])
      mockSingleMetadataInstance('Quote', { fullName: 'QuoteSettings' })

      await adapter.discover()

      expect(connection.metadata.read).toHaveBeenCalledWith('QuoteSettings', ['Quote'])
    })
  })
})
