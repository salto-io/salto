import { MetadataInfo } from 'jsforce'
import { ObjectType, Type } from 'adapter-api'
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
      .mockImplementationOnce(() => {
        return result
      })
  }

  // The result should be MetadataObject we will validate result has at lease xmlName
  function mockListMetadataTypes(result: { xmlName: string }[] = []): void {
    SalesforceClient.prototype.listMetadataTypes = jest
      .fn()
      .mockImplementationOnce(() => {
        return result
      })
  }

  function mockSingleSObject(
    name: string,
    fields: Record<string, any>[]
  ): void {
    mockListSObjects([{ name }])
    mockListMetadataTypes()
    SalesforceClient.prototype.discoverSObject = jest
      .fn()
      .mockImplementationOnce(() => {
        return fields
      })
  }

  function mockListMetadataObjects(result: MetadataInfo[] = []): void {
    SalesforceClient.prototype.listMetadataObjects = jest
      .fn()
      .mockImplementationOnce(() => {
        return result
      })
  }

  function mockSingleMetadataObject(
    xmlName: string,
    fields: Record<string, any>[]
  ): void {
    mockListMetadataTypes([{ xmlName }])
    SalesforceClient.prototype.discoverMetadataObject = jest
      .fn()
      .mockImplementationOnce(() => {
        return fields
      })
  }

  function mockReadMetadata(result: MetadataInfo | ProfileInfo): void {
    SalesforceClient.prototype.readMetadata = jest
      .fn()
      .mockImplementationOnce(() => {
        return result
      })
  }

  function adapter(): SalesforceAdapter {
    return new SalesforceAdapter({
      username: '',
      password: '',
      token: '',
      sandbox: false
    })
  }

  it('should discover sobject with primitive types, validate type, label, required and default annotations', async () => {
    mockListMetadataObjects()
    mockSingleSObject('Lead', [
      {
        name: 'LastName',
        type: 'string',
        label: 'Last Name',
        nillable: false,
        defaultValue: 'BLABLA'
      },
      {
        name: 'FirstName',
        type: 'string',
        label: 'First Name',
        nillable: true
      },
      {
        name: 'IsDeleted',
        type: 'boolean',
        label: 'Is Deleted',
        defaultValue: false
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.last_name.typeID.name).toBe('string')
    expect(lead.fields.last_name.annotationsValues.label).toBe('Last Name')
    // Test Rquired true and false
    expect(lead.fields.last_name.annotationsValues.required).toBe(false)
    expect(lead.fields.first_name.annotationsValues.required).toBe(true)
    // Default string and boolean
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.last_name.annotationsValues._default).toBe('BLABLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.is_deleted.annotationsValues._default).toBe(false)
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
          { value: 'Yes', defaultValue: true }
        ],
        restrictedPicklist: true
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.primary_c.typeID.name).toBe('picklist')
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
          { value: 'Yes', defaultValue: true }
        ]
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.primary_c.typeID.name).toBe('combobox')
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
        nillable: true
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop() as ObjectType

    expect(lead.fields.double_field.typeID.name).toBe('number')
  })

  it('should discover sobject permissions', async () => {
    mockListMetadataObjects([{ fullName: 'Admin' }])
    mockReadMetadata({
      fullName: 'Admin',
      fieldPermissions: [
        {
          field: 'Org__c.Status',
          readable: true,
          editable: false
        }
      ]
    })
    mockSingleSObject('Org__c', [
      {
        name: 'Status',
        type: 'boolean',
        label: 'Field',
        nillable: false
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const org = result.pop() as ObjectType
    expect(
      org.fields.status.annotationsValues[constants.FIELD_LEVEL_SECURITY].admin
        .readable
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
        valueRequired: true
      },
      {
        name: 'IsTemplate',
        soapType: 'boolean',
        valueRequired: false
      },
      {
        name: 'ActionCalls',
        soapType: 'FlowActionCall'
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const flow = result.pop() as ObjectType

    expect(flow.fields.description.typeID.name).toBe('string')
    // TODO: validate what is expected from this metadata type
    expect(flow.annotationsValues[constants.API_NAME]).toBe('Flow')
    expect(flow.fields.description.annotationsValues[Type.REQUIRED]).toBe(true)
    expect(flow.fields.is_template.typeID.name).toBe('checkbox')
    expect(flow.fields.is_template.annotationsValues[Type.REQUIRED]).toBe(false)
    expect(flow.fields.action_calls.typeID.getFullName()).toBe(
      'salesforce_FlowActionCall'
    )
  })

  it('should discover metadata object with picklist', async () => {
    mockListSObjects()
    mockListMetadataObjects()
    mockSingleMetadataObject('Flow', [
      {
        name: 'Status',
        soapType: 'Picklist',
        valueRequired: false,
        picklistValues: [{ defaultValue: true, value: 'BLA' }]
      },
      {
        name: 'StatusCombo',
        soapType: 'Combobox',
        valueRequired: true,
        picklistValues: [
          { defaultValue: true, value: 'BLA' },
          { defaultValue: true, value: 'BLA2' }
        ]
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const flow = result.pop() as ObjectType
    // Validate picklist
    expect(flow.fields.status.typeID.name).toBe('Picklist')
    expect(flow.fields.status.annotationsValues.required).toBe(false)
    expect(flow.fields.status.annotationsValues.values.length).toBe(1)
    expect(flow.fields.status.annotationsValues.values[0]).toBe('BLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(flow.fields.status.annotationsValues._default).toBe('BLA')

    // Validate combobox
    expect(flow.fields.status_combo.typeID.name).toBe('Combobox')
    expect(flow.fields.status_combo.annotationsValues.required).toBe(true)
    expect(flow.fields.status_combo.annotationsValues.values.length).toBe(2)
    expect(flow.fields.status_combo.annotationsValues.values[0]).toBe('BLA')
    expect(flow.fields.status_combo.annotationsValues.values[1]).toBe('BLA2')
    // eslint-disable-next-line no-underscore-dangle
    expect(flow.fields.status_combo.annotationsValues._default[1]).toBe('BLA2')
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
})
