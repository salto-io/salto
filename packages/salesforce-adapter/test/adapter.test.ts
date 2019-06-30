import { MetadataInfo } from 'jsforce'
import { ObjectType, PrimitiveType, TypeID, PrimitiveTypes } from 'salto'
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
    const lead = result.pop() as ObjectType

    expect(lead.fields.LastName.typeID.name).toBe('string')
    expect(lead.fields.LastName.annotationsValues.label).toBe('Last Name')
    // Test Rquired true and false
    expect(lead.fields.LastName.annotationsValues.required).toBe(false)
    expect(lead.fields.FirstName.annotationsValues.required).toBe(true)
    // Default string and boolean
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.LastName.annotationsValues._default).toBe('BLABLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.IsDeleted.annotationsValues._default).toBe(false)
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
    const lead = result.pop() as ObjectType

    expect(lead.fields.PrimaryC.typeID.name).toBe('picklist')
    expect(
      (lead.fields.PrimaryC.annotationsValues.values as string[]).join(';')
    ).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.PrimaryC.annotationsValues._default).toBe('Yes')
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

    expect(lead.fields.PrimaryC.typeID.name).toBe('combobox')
    expect(
      (lead.fields.PrimaryC.annotationsValues.values as string[]).join(';')
    ).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.PrimaryC.annotationsValues._default.length).toBe(1)
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.fields.PrimaryC.annotationsValues._default.pop()).toBe('Yes')
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
    const org = result.pop() as ObjectType
    expect(
      org.fields.status.annotationsValues.field_level_security.admin.readable
    ).toBe(true)
    expect(
      org.fields.status.annotationsValues.field_level_security.admin.editable
    ).toBe(false)
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

    const result = await adapter().add(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              required: false,
              _default: 'test',
              label: 'test label'
            }
          })
        }
      })
    )

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
        name: 'description',
        soapType: 'string',
        valueRequired: true
      },
      {
        name: 'isTemplate',
        soapType: 'boolean',
        valueRequired: false
      },
      {
        name: 'actionCalls',
        soapType: 'FlowActionCall'
      }
    ])
    const result = await adapter().discover()

    expect(result.length).toBe(1)
    const flow = result.pop() as ObjectType

    expect(flow.fields.description.typeID.name).toBe('string')
    expect(flow.fields.description.annotationsValues.required).toBe(true)
    expect(flow.fields.isTemplate.typeID.name).toBe('checkbox')
    expect(flow.fields.isTemplate.annotationsValues.required).toBe(false)
    expect(flow.fields.actionCalls.typeID.getFullName()).toBe(
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
    expect(flow.fields.Status.typeID.name).toBe('Picklist')
    expect(flow.fields.Status.annotationsValues.required).toBe(false)
    expect(flow.fields.Status.annotationsValues.values.length).toBe(1)
    expect(flow.fields.Status.annotationsValues.values[0]).toBe('BLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(flow.fields.Status.annotationsValues._default).toBe('BLA')

    // Validate combobox
    expect(flow.fields.StatusCombo.typeID.name).toBe('Combobox')
    expect(flow.fields.StatusCombo.annotationsValues.required).toBe(true)
    expect(flow.fields.StatusCombo.annotationsValues.values.length).toBe(2)
    expect(flow.fields.StatusCombo.annotationsValues.values[0]).toBe('BLA')
    expect(flow.fields.StatusCombo.annotationsValues.values[1]).toBe('BLA2')
    // eslint-disable-next-line no-underscore-dangle
    expect(flow.fields.StatusCombo.annotationsValues._default[1]).toBe('BLA2')
  })

  it('should remove a salesforce metadata component', async () => {
    const mockDelete = jest.fn().mockImplementationOnce(() => {
      return { success: true }
    })
    SalesforceClient.prototype.delete = mockDelete

    const result = await adapter().remove(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string'
            }),
            primitive: PrimitiveTypes.STRING
          })
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label'
        }
      })
    )

    expect(result).toBe(true)
    expect(mockDelete.mock.calls.length).toBe(1)
    const fullName = mockDelete.mock.calls[0][1]
    expect(fullName).toBe('test__c')
  })
})
