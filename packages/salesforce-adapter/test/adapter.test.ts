import { MetadataInfo } from 'jsforce'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client'
import { ProfileInfo } from '../src/salesforce_types'
import * as constants from '../src/constants'

jest.mock('../src/client')

describe('Test SalesforceAdapter.discover', () => {
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
    const lead = result.pop()

    expect(lead.LastName.type).toBe('string')
    expect(lead.LastName.label).toBe('Last Name')
    // Test Rquired true and false
    expect(lead.LastName.required).toBe(false)
    expect(lead.FirstName.required).toBe(true)
    // Default string and boolean
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.LastName._default).toBe('BLABLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.IsDeleted._default).toBe(false)
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
        ]
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const lead = result.pop()

    expect(lead.PrimaryC.type).toBe('picklist')
    expect((lead.PrimaryC.values as string[]).join(';')).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.PrimaryC._default).toBe('Yes')
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
    const lead = result.pop()

    expect(lead.PrimaryC.type).toBe('combobox')
    expect((lead.PrimaryC.values as string[]).join(';')).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.PrimaryC._default.length).toBe(1)
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.PrimaryC._default.pop()).toBe('Yes')
  })

  it('should discover sobject permissions', async () => {
    mockListMetadataObjects([{ fullName: 'admin' }])
    mockReadMetadata({
      fullName: 'admin',
      fieldPermissions: [
        {
          field: 'Org__c.status',
          readable: true,
          editable: false
        }
      ]
    })
    mockSingleSObject('Org__c', [
      {
        name: 'status',
        type: 'boolean',
        label: 'Field',
        nillable: false
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const org = result.pop()
    expect(org.status.field_level_security.admin.readable).toBe(true)
    expect(org.status.field_level_security.admin.editable).toBe(false)
  })

  it('should add new salesforce type', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => {
      return { success: true }
    })
    const mockUpdate = jest.fn().mockImplementationOnce(() => {
      return { success: true }
    })
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.update = mockUpdate

    const result = await adapter().add({
      object: 'test',
      description: {
        type: 'string',
        label: 'test label',
        required: false,
        _default: 'test'
      }
    })

    // Verify object creation
    expect(result).toBe(true)
    expect(mockCreate.mock.calls.length).toBe(1)
    const object = mockCreate.mock.calls[0][1]
    expect(object.fullName).toBe('test__c')
    expect(object.fields.length).toBe(1)
    expect(object.fields[0].fullName).toBe('description__c')
    expect(object.fields[0].type).toBe('Text')
    expect(object.fields[0].length).toBe(80)
    expect(object.fields[0].required).toBe(false)
    expect(object.fields[0].label).toBe('test label')

    // Verify permissions creation
    expect(mockUpdate.mock.calls.length).toBe(1)
    const updateObject = mockUpdate.mock.calls[0][1]
    expect(updateObject.fullName).toBe(
      constants.PROFILE_NAME_SYSTEM_ADMINISTRATOR
    )
    expect(updateObject.fieldPermissions.length).toBe(1)
    expect(updateObject.fieldPermissions[0].field).toBe(
      'test__c.description__c'
    )
    expect(updateObject.fieldPermissions[0].editable).toBe(true)
    expect(updateObject.fieldPermissions[0].readable).toBe(true)
  })

  it('should discover metadata object', async () => {
    mockListSObjects()
    mockListMetadataObjects()
    mockSingleMetadataObject('Flow', [
      {
        name: 'Description',
        soapType: 'string',
        valueRequired: true
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const flow = result.pop()

    expect(flow.Description.type).toBe('string')
    expect(flow.Description.required).toBe(true)
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
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const flow = result.pop()
    expect(flow.Status.type).toBe('Picklist')
    expect(flow.Status.required).toBe(false)
    expect(flow.Status.values.length).toBe(1)
    expect(flow.Status.values[0]).toBe('BLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(flow.Status._default).toBe('BLA')
  })

  it('should remove a salesforce metadata component', async () => {
    const mockDelete = jest.fn().mockImplementationOnce(() => {
      return { success: true }
    })
    SalesforceClient.prototype.delete = mockDelete

    const result = await adapter().remove({
      object: 'test',
      description: {
        type: 'string',
        label: 'test label',
        required: false,
        _default: 'test'
      }
    })

    expect(result).toBe(true)
    expect(mockDelete.mock.calls.length).toBe(1)
    const fullName = mockDelete.mock.calls[0][1]
    expect(fullName).toBe('test__c')
  })
})
