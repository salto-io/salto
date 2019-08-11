import _ from 'lodash'
import {
  ObjectType, Type, InstanceElement, ElemID,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client/client'
import * as constants from '../src/constants'
import { Types } from '../src/transformer'

jest.mock('../src/client/client')

describe('Test SalesforceAdapter discover', () => {
  const adapter = (): SalesforceAdapter => {
    const a = new SalesforceAdapter()
    const configType = a.getConfigType()
    const value = {
      username: '',
      password: '',
      token: '',
      sandbox: false,
    }
    const elemID = new ElemID('salesforce')
    const config = new InstanceElement(elemID, configType, value)
    a.init(config)
    return a
  }

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('should discover SObjects', () => {
    const mockSingleSObject = (name: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[]): void => {
      SalesforceClient.prototype.listSObjects = jest.fn().mockImplementation(() => [{ name }])
      SalesforceClient.prototype.describeSObjects = jest.fn().mockImplementation(
        () => [{ name, fields }]
      )
      SalesforceClient.prototype.listMetadataTypes = jest.fn().mockImplementation(() => [])
      SalesforceClient.prototype.listMetadataObjects = jest.fn().mockImplementation(() => [])
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
      const result = await adapter().discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.last_name.type.elemID.name).toBe('text')
      expect(lead.fields.last_name.getAnnotationsValues().label).toBe('Last Name')
      // Test Rquired true and false
      expect(lead.fields.last_name.getAnnotationsValues()[Type.REQUIRED]).toBe(true)
      expect(lead.fields.first_name.getAnnotationsValues()[Type.REQUIRED]).toBe(false)
      // Default string and boolean
      expect(lead.fields.last_name.getAnnotationsValues()[Type.DEFAULT]).toBe('BLABLA')
      expect(lead.fields.is_deleted.getAnnotationsValues()[Type.DEFAULT]).toBe(false)
      // Custom type
      expect(lead.fields.custom).not.toBeUndefined()
      expect(lead.fields.custom.getAnnotationsValues()[constants.API_NAME]).toBe('Custom__c')
      expect(lead.fields.custom.getAnnotationsValues()[Type.DEFAULT]).toBe(false)
      // Formula field
      expect(lead.fields.formula).toBeDefined()
      expect(lead.fields.formula.type.elemID.name).toBe('formula_text')
      expect(lead.fields.formula.getAnnotationsValues()[constants.FORMULA]).toBe('my formula')
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
      const result = await adapter().discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('picklist')
      expect(
        (lead.fields.primary_c.getAnnotationsValues().values as string[]).join(';')
      ).toBe('No;Yes')
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.primary_c.getAnnotationsValues()._default).toBe('Yes')
      expect(
        lead.fields.primary_c.getAnnotationsValues()[constants.RESTRICTED_PICKLIST]
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
      const result = await adapter().discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.primary_c.type.elemID.name).toBe('combobox')
      expect(
        (lead.fields.primary_c.getAnnotationsValues().values as string[]).join(';')
      ).toBe('No;Yes')
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.primary_c.getAnnotationsValues()._default.length).toBe(1)
      // eslint-disable-next-line no-underscore-dangle
      expect(lead.fields.primary_c.getAnnotationsValues()._default.pop()).toBe('Yes')
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
      const result = await adapter().discover()

      const lead = result.filter(o => o.elemID.name === 'lead').pop() as ObjectType
      expect(lead.fields.number_field.type.elemID.name).toBe('number')
    })
  })

  describe('should discover metadata types', () => {
    const mockSingleMetadataType = (xmlName: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: Record<string, any>[]): void => {
      SalesforceClient.prototype.listSObjects = jest.fn().mockImplementation(() => [])
      SalesforceAdapter.DISCOVER_METADATA_TYPES_WHITELIST = [xmlName]
      SalesforceClient.prototype.describeMetadataType = jest.fn().mockImplementation(() => fields)
      SalesforceClient.prototype.listMetadataObjects = jest.fn().mockImplementation(() => [])
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSingleMetadataInstance = (name: string, data: Record<string, any>): void => {
      SalesforceClient.prototype.listMetadataObjects = jest.fn().mockImplementation(() =>
        [{ fullName: name }])
      SalesforceClient.prototype.readMetadata = jest.fn().mockImplementation(() => data)
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
          name: 'ActionCalls',
          soapType: 'FlowActionCall',
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
      const result = await adapter().discover()

      const describeMock = SalesforceClient.prototype.describeMetadataType as jest.Mock<unknown>
      expect(describeMock).toHaveBeenCalled()
      expect(describeMock.mock.calls[0][0]).toBe('Flow')
      const flow = result.filter(o => o.elemID.name === 'flow_type').pop() as ObjectType
      expect(flow.fields.description.type.elemID.name).toBe('string')
      expect(flow.fields.description.getAnnotationsValues()[Type.REQUIRED]).toBe(true)
      expect(flow.fields.is_template.type.elemID.name).toBe('boolean')
      expect(flow.fields.is_template.getAnnotationsValues()[Type.REQUIRED]).toBe(false)
      expect(flow.fields.action_calls.type.elemID.name).toBe('flow_action_call_type')
      expect(flow.fields.enum.type.elemID.name).toBe('string')
      expect(flow.fields.enum.getAnnotationsValues()[Type.DEFAULT]).toBe('yes')
      expect(flow.fields.enum.getAnnotationsValues()[Type.RESTRICTION]).toEqual({
        values: ['yes', 'no'],
      })
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
      SalesforceAdapter.DISCOVER_METADATA_TYPES_WHITELIST = ['nesting_type']

      const result = await adapter().discover()

      expect(result).toHaveLength(Object.keys(Types.salesforceDataTypes).length + 3)
      const types = _.assign({}, ...result.map(t => ({ [t.elemID.getFullName()]: t })))
      const nestingType = types.salesforce_nesting_type_type
      const nestedType = types.salesforce_nested_type_type
      const singleField = types.salesforce_single_field_type_type
      expect(nestingType).not.toBeUndefined()
      expect(nestingType.fields.field.type.elemID.name).toEqual('nested_type_type')
      expect(nestingType.fields.other_field.type.elemID.name).toEqual('single_field_type_type')
      expect(nestedType).not.toBeUndefined()
      expect(nestedType.fields.nested_str.type.elemID.name).toEqual('string')
      expect(nestedType.fields.nested_num.type.elemID.name).toEqual('number')
      expect(nestedType.fields.double_nested.type.elemID.name).toEqual('single_field_type_type')
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

      const result = await adapter().discover()
      const flow = result.filter(o => o.elemID.name === 'flow_flow_instance').pop() as InstanceElement
      expect(flow.type.elemID.getFullName()).toBe('salesforce_flow_type')
      expect(flow.elemID.getFullName()).toBe('salesforce_flow_flow_instance')
      expect(flow.value.bla.bla).toBe(55)
      expect(flow.value.bla.bla_2).toBe(false)
      expect(flow.value.bla.bla_3).toBe(true)
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

      SalesforceClient.prototype.listMetadataObjects = jest.fn().mockImplementation(() =>
        [{ fullName: 'FlowInstance' }, { fullName: 'FlowInstance2' }])
      SalesforceClient.prototype.readMetadata = jest.fn().mockImplementation(() => ([{
        fullName: 'FlowInstance',
        listTest: [{ field: 'Field1', editable: 'true' },
          { field: 'Field2', editable: 'false' }],
      },
      {
        fullName: 'FlowInstance2',
        listTest: { field: 'Field11', editable: 'true' },
      }]))

      const result = await adapter().discover()
      const flow = result.filter(o => o.elemID.name === 'flow_flow_instance').pop() as InstanceElement
      expect(flow.type.elemID.getFullName()).toBe('salesforce_flow_type')
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

      await adapter().discover()

      expect(SalesforceClient.prototype.readMetadata).toHaveBeenCalledWith('QuoteSettings', 'Quote')
    })
  })
})
