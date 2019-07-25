import { MetadataInfo } from 'jsforce'
import _ from 'lodash'
import {
  ObjectType, Type, InstanceElement, ElemID,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client/client'
import { ProfileInfo } from '../src/client/types'
import * as constants from '../src/constants'

jest.mock('../src/client/client')

describe('Test SalesforceAdapter discover', () => {
  // input should be DescribeGlobalSObjectResult, we will validate obj has at least name
  function mockListSObjects(result: { name: string }[] = []): void {
    SalesforceClient.prototype.listSObjects = jest
      .fn()
      .mockImplementationOnce(() => result)
  }

  // The result should be MetadataObject we will validate result has at lease xmlName
  function mockListMetadataTypes(result: { xmlName: string }[] = []): void {
    SalesforceClient.prototype.listMetadataTypes = jest
      .fn()
      .mockImplementationOnce(() => result)
  }

  function mockSingleSObject(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: Record<string, any>[]
  ): void {
    mockListSObjects([{ name }])
    mockListMetadataTypes()
    SalesforceClient.prototype.discoverSObject = jest
      .fn()
      .mockImplementationOnce(() => fields)
  }

  function mockListMetadataObjects(result: MetadataInfo[] = []): void {
    SalesforceClient.prototype.listMetadataObjects = jest
      .fn()
      .mockImplementationOnce(() => result)
  }

  function mockSingleMetadataObject(
    xmlName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: Record<string, any>[]
  ): void {
    mockListMetadataTypes([{ xmlName }])
    SalesforceClient.prototype.discoverMetadataObject = jest
      .fn()
      .mockImplementationOnce(() => fields)
  }

  function mockReadMetadata(result: MetadataInfo | ProfileInfo): void {
    SalesforceClient.prototype.readMetadata = jest
      .fn()
      .mockImplementationOnce(() => result)
  }

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

  it('should discover sobject with primitive types, validate type, label, required and default annotations', async () => {
    mockListMetadataObjects()
    mockSingleSObject('Lead', [
      {
        name: 'LastName',
        type: 'string',
        label: 'Last Name',
        nillable: false,
        defaultValue: 'BLABLA',
      },
      {
        name: 'FirstName',
        type: 'string',
        label: 'First Name',
        nillable: true,
      },
      {
        name: 'IsDeleted',
        type: 'boolean',
        label: 'Is Deleted',
        defaultValue: false,
      },
      {
        name: 'Custom__c',
        type: 'string',
        label: 'Custom Field',
        nillable: true,
      },
      {
        name: 'Formula__c',
        type: 'string',
        label: 'Dummy formula',
        calculated: true,
        calculatedFormula: 'my formula',
      },
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.last_name.type.elemID.name).toBe('string')
    expect(lead.fields.last_name.annotationsValues.label).toBe('Last Name')
    // Test Rquired true and false
    expect(lead.fields.last_name.annotationsValues[Type.REQUIRED]).toBe(true)
    expect(lead.fields.first_name.annotationsValues[Type.REQUIRED]).toBe(false)
    // Default string and boolean
    expect(lead.fields.last_name.annotationsValues[Type.DEFAULT]).toBe('BLABLA')
    expect(lead.fields.is_deleted.annotationsValues[Type.DEFAULT]).toBe(false)
    // Custom field
    expect(lead.fields.custom).toBeDefined()
    expect(lead.fields.custom.annotationsValues[constants.API_NAME]).toBe('Custom__c')
    // Formula field
    expect(lead.fields.formula).toBeDefined()
    expect(lead.fields.formula.type.elemID.name).toBe('formula_string')
    expect(lead.fields.formula.annotationsValues[constants.FORMULA]).toBe('my formula')
  })

  it('should discover sobject with picklist field', async () => {
    mockListMetadataObjects()
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

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.primary_c.type.elemID.name).toBe('picklist')
    expect(
      (lead.fields.primary_c.annotationsValues.values as string[]).join(';')
    ).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.primary_c.annotationsValues._default).toBe('Yes')
    expect(
      lead.fields.primary_c.annotationsValues[constants.RESTRICTED_PICKLIST]
    ).toBe(true)
  })

  it('should discover sobject with combobox field', async () => {
    mockListMetadataObjects()
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

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.primary_c.type.elemID.name).toBe('combobox')
    expect(
      (lead.fields.primary_c.annotationsValues.values as string[]).join(';')
    ).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.primary_c.annotationsValues._default.length).toBe(1)
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.primary_c.annotationsValues._default.pop()).toBe('Yes')
  })

  it('should discover sobject with double field', async () => {
    mockListMetadataObjects()
    mockSingleSObject('Lead', [
      {
        name: 'DoubleField',
        type: 'double',
        label: 'DDD',
        nillable: true,
      },
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.double_field.type.elemID.name).toBe('number')
  })

  it('should discover sobject permissions', async () => {
    mockListMetadataObjects([{ fullName: 'Admin' }])
    mockReadMetadata({
      fullName: 'Admin',
      fieldPermissions: [
        {
          field: 'Org__c.Status',
          readable: true,
          editable: false,
        },
      ],
    })
    mockSingleSObject('Org__c', [
      {
        name: 'Status',
        type: 'boolean',
        label: 'Field',
        nillable: false,
      },
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const org = result.pop() as ObjectType
    expect(
      org.fields.status.annotationsValues[constants.FIELD_LEVEL_SECURITY].admin.readable
    ).toBe(true)
    expect(
      org.fields.status.annotationsValues.field_level_security.admin.editable
    ).toBe(false)
  })

  it('should discover metadata object', async () => {
    mockListSObjects()
    mockListMetadataObjects()
    mockSingleMetadataObject('Flow', [
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

    expect(result.length).toBe(1)
    const flow = result.pop() as ObjectType

    expect(flow.fields.description.type.elemID.name).toBe('string')
    // TODO: validate what is expected from this metadata type
    expect(flow.annotationsValues[constants.API_NAME]).toBe('Flow')
    expect(flow.fields.description.annotationsValues[Type.REQUIRED]).toBe(true)
    expect(flow.fields.is_template.type.elemID.name).toBe('boolean')
    expect(flow.fields.is_template.annotationsValues[Type.REQUIRED]).toBe(false)
    expect(flow.fields.action_calls.type.elemID.name).toBe('flow_action_call')
    expect(flow.fields.enum.type.elemID.name).toBe('string')
    expect(flow.fields.enum.annotationsValues[Type.DEFAULT]).toBe('yes')
    expect(flow.fields.enum.annotationsValues[Type.RESTRICTION]).toEqual({
      values: ['yes', 'no'],
    })
  })

  it('should discover empty metadata object', async () => {
    mockListSObjects()
    mockListMetadataObjects()
    mockSingleMetadataObject('Empty', [])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const empty = result.pop() as ObjectType
    expect(Object.keys(empty.fields).length).toBe(0)
  })

  it('should discover nested metadata types', async () => {
    mockListSObjects()
    mockListMetadataObjects()
    mockSingleMetadataObject('NestingType', [
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
            soapType: 'number',
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

    const result = await adapter().discover()

    expect(result).toHaveLength(3)
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
})
