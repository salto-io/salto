import {
  ObjectType,
  PrimitiveType,
  TypeID,
  PrimitiveTypes,
  InstanceElement,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client/client'
import * as constants from '../src/constants'

jest.mock('../src/client/client')

describe('Test SalesforceAdapter CRUD', () => {
  function adapter(): SalesforceAdapter {
    const configType = SalesforceAdapter.getConfigType()
    const value = {
      username: '',
      password: '',
      token: '',
      sandbox: false,
    }
    const typeID = new TypeID({ adapter: 'salesforce' })
    const config = new InstanceElement(typeID, configType, value)
    return new SalesforceAdapter(config)
  }

  it('should add new salesforce type', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.update = mockUpdate

    const result = await adapter().add(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              required: false,
              _default: 'test',
              label: 'test label',
            },
          }),
        },
      })
    )

    // Verify object creation
    expect(result.annotationsValues[constants.API_NAME]).toBe('Test__c')
    expect(
      result.fields.description.annotationsValues[constants.API_NAME]
    ).toBe('Description__c')

    expect(mockCreate.mock.calls.length).toBe(1)
    const object = mockCreate.mock.calls[0][1]
    expect(object.fullName).toBe('Test__c')
    expect(object.fields.length).toBe(1)
    expect(object.fields[0].fullName).toBe('Description__c')
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
      'Test__c.Description__c'
    )
    expect(updateObject.fieldPermissions[0].editable).toBe(true)
    expect(updateObject.fieldPermissions[0].readable).toBe(true)
  })

  it('should fail add new salesforce type', async () => {
    SalesforceClient.prototype.create = jest
      .fn()
      .mockImplementationOnce(async () => ({
        success: false,
        fullName: 'Test__c',
        errors: [
          {
            message: 'Failed to add Test__c',
          },
          {
            message: 'Additional message',
          },
        ],
      }))

    return expect(
      adapter().add(
        new ObjectType({
          typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        })
      )
    ).rejects.toEqual(new Error('Failed to add Test__c\nAdditional message'))
  })

  it('should fail add new salesforce type due to permissions', async () => {
    SalesforceClient.prototype.create = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.update = jest.fn().mockImplementationOnce(() => ({
      success: false,
      errors: [
        {
          message: 'Failed to update permissions',
        },
      ],
    }))

    return expect(
      adapter().add(
        new ObjectType({
          typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        })
      )
    ).rejects.toEqual(new Error('Failed to update permissions'))
  })

  it('should remove a salesforce metadata component', async () => {
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.delete = mockDelete

    await adapter().remove(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
        },
        annotationsValues: {
          // eslint-disable-next-line @typescript-eslint/camelcase
          api_name: 'Test__c',
        },
      })
    )

    expect(mockDelete.mock.calls.length).toBe(1)
    const fullName = mockDelete.mock.calls[0][1]
    expect(fullName).toBe('Test__c')
  })

  it('should fail remove new salesforce type', async () => {
    SalesforceClient.prototype.delete = jest.fn().mockImplementationOnce(() => ({
      success: false,
      fullName: 'Test__c',
      errors: [
        {
          message: 'Failed to remove Test__c',
        },
      ],
    }))

    return expect(
      adapter().remove(
        new ObjectType({
          typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
          annotationsValues: {
            // eslint-disable-next-line @typescript-eslint/camelcase
            api_name: 'Test__c',
          },
        })
      )
    ).rejects.toEqual(new Error('Failed to remove Test__c'))
  })

  it('should fail an update of a salesforce metadata component if the fullnames are not the same', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.delete = mockDelete
    SalesforceClient.prototype.update = mockUpdate

    expect(
      adapter().update(
        new ObjectType({
          typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test2' }),
          fields: {
            description: new PrimitiveType({
              typeID: new TypeID({
                adapter: constants.SALESFORCE,
                name: 'string',
              }),
              primitive: PrimitiveTypes.STRING,
            }),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            // eslint-disable-next-line @typescript-eslint/camelcase
            api_name: 'Test2__c',
          },
        }),
        new ObjectType({
          typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: new PrimitiveType({
              typeID: new TypeID({
                adapter: constants.SALESFORCE,
                name: 'string',
              }),
              primitive: PrimitiveTypes.STRING,
            }),
          },
          annotationsValues: {
            required: false,
            _default: 'test2',
            label: 'test2 label',
          },
        })
      )
    ).rejects.toBeInstanceOf(Error)

    expect(mockCreate.mock.calls.length).toBe(0)
    expect(mockDelete.mock.calls.length).toBe(0)
    expect(mockUpdate.mock.calls.length).toBe(0)
  })

  it('should perform a successful update of a salesforce metadata component if the fullnames are the same', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.delete = mockDelete
    SalesforceClient.prototype.update = mockUpdate

    const result = await adapter().update(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          // eslint-disable-next-line @typescript-eslint/camelcase
          api_name: 'Test__c',
        },
      }),
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          address: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test2 label',
        },
      })
    )

    expect(result).toBeInstanceOf(ObjectType)
    expect(mockCreate.mock.calls.length).toBe(1)
    expect(mockDelete.mock.calls.length).toBe(1)
    expect(mockUpdate.mock.calls.length).toBe(1)
  })
  it("should only create new fields when the new object's change is only new fields", async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => [{ success: true },
      { success: true }])
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.delete = mockDelete
    SalesforceClient.prototype.update = mockUpdate

    const result = await adapter().update(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          address: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          // eslint-disable-next-line @typescript-eslint/camelcase
          api_name: 'Test__c',
        },
      }),
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          address: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
          apple: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'double',
            }),
            primitive: PrimitiveTypes.NUMBER,
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test2 label',
        },
      })
    )

    expect(result).toBeInstanceOf(ObjectType)
    expect(mockCreate.mock.calls.length).toBe(1)
    expect(mockDelete.mock.calls.length).toBe(0)
    expect(mockUpdate.mock.calls.length).toBe(1)
    // Verify the custom fields creation
    const fields = mockCreate.mock.calls[0][1]
    expect(fields.length).toBe(2)
    expect(fields[0].fullName).toBe('Test__c.Description__c')
    expect(fields[0].type).toBe('Text')
    expect(fields[0].length).toBe(80)
    expect(fields[0].required).toBe(false)
    expect(fields[1].fullName).toBe('Test__c.Apple__c')
    // Verify the field permissions update
    const profileInfo = mockUpdate.mock.calls[0][1]
    expect(profileInfo.fullName).toBe('Admin')
    expect(profileInfo.fieldPermissions.length).toBe(2)
    expect(profileInfo.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(profileInfo.fieldPermissions[0].editable).toBe(true)
    expect(profileInfo.fieldPermissions[0].readable).toBe(true)
    expect(profileInfo.fieldPermissions[1].field).toBe('Test__c.Apple__c')
  })

  it('should only delete fields when the only change in the new object is that some fields no longer appear', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.delete = mockDelete
    SalesforceClient.prototype.update = mockUpdate

    const result = await adapter().update(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          address: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_name: 'Address__c',
            },
          }),
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_name: 'Banana__c',
            },
          }),
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_name: 'Description__c',
            },
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          // eslint-disable-next-line @typescript-eslint/camelcase
          api_name: 'Test__c',
        },
      }),
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_name: 'Description__c',
            },
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test2 label',
        },
      })
    )

    expect(result).toBeInstanceOf(ObjectType)
    expect(mockCreate.mock.calls.length).toBe(0)
    expect(mockDelete.mock.calls.length).toBe(1)
    expect(mockUpdate.mock.calls.length).toBe(0)
    // Verify the custom fields deletion
    const fields = mockDelete.mock.calls[0][1]
    expect(fields.length).toBe(2)
    expect(fields[0]).toBe('Test__c.Address__c')
    expect(fields[1]).toBe('Test__c.Banana__c')
  })

  // Add a test that combines both
  it('should both create & delete fields when some fields no longer appear in the new object and some fields are new', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.delete = mockDelete
    SalesforceClient.prototype.update = mockUpdate

    const result = await adapter().update(
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          address: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_name: 'Address__c',
            },
          }),
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
            annotationsValues: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_name: 'Banana__c',
            },
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test',
          label: 'test label',
          // eslint-disable-next-line @typescript-eslint/camelcase
          api_name: 'Test__c',
        },
      }),
      new ObjectType({
        typeID: new TypeID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          banana: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
          description: new PrimitiveType({
            typeID: new TypeID({
              adapter: constants.SALESFORCE,
              name: 'string',
            }),
            primitive: PrimitiveTypes.STRING,
          }),
        },
        annotationsValues: {
          required: false,
          _default: 'test2',
          label: 'test2 label',
        },
      })
    )

    expect(result).toBeInstanceOf(ObjectType)
    expect(mockCreate.mock.calls.length).toBe(1)
    expect(mockDelete.mock.calls.length).toBe(1)
    expect(mockUpdate.mock.calls.length).toBe(1)
    // Verify the custom fields creation
    const addedFields = mockCreate.mock.calls[0][1]
    expect(addedFields.length).toBe(1)
    const field = addedFields[0]
    expect(field.fullName).toBe('Test__c.Description__c')
    expect(field.type).toBe('Text')
    expect(field.length).toBe(80)
    expect(field.required).toBe(false)
    // Verify the field permissions update
    const profileInfo = mockUpdate.mock.calls[0][1]
    expect(profileInfo.fullName).toBe('Admin')
    expect(profileInfo.fieldPermissions.length).toBe(1)
    expect(profileInfo.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(profileInfo.fieldPermissions[0].editable).toBe(true)
    expect(profileInfo.fieldPermissions[0].readable).toBe(true)
    // Verify the custom fields deletion
    const deletedFields = mockDelete.mock.calls[0][1]
    expect(deletedFields.length).toBe(1)
    expect(deletedFields[0]).toBe('Test__c.Address__c')
  })
})
