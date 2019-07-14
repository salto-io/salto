import {
  ObjectType,
  PrimitiveType,
  ElemID,
  PrimitiveTypes,
  InstanceElement,
} from 'adapter-api'
import { ProfileInfo } from '../src/client/types'
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
    const elemID = new ElemID({ adapter: 'salesforce' })
    const config = new InstanceElement(elemID, configType, value)
    return new SalesforceAdapter(config)
  }

  const stringType = new PrimitiveType({
    elemID: new ElemID({
      adapter: constants.SALESFORCE,
      name: 'string',
    }),
    primitive: PrimitiveTypes.STRING,
  })

  it('should add new salesforce type', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.update = jest.fn().mockImplementationOnce(() => ({ success: true }))

    const result = await adapter().add(
      new ObjectType({
        elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: stringType,
        },
        annotationsValues: {
          description: {
            required: false,
            _default: 'test',
            label: 'test label',
          },
        },
      })
    )

    // Verify object creation
    expect(result.annotationsValues[constants.API_NAME]).toBe('Test__c')
    expect(
      result.annotationsValues.description[constants.API_NAME]
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
  })

  it('should update field permissions upon new salesforce type', async () => {
    SalesforceClient.prototype.create = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.update = mockUpdate

    await adapter().add(
      new ObjectType({
        elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: stringType,
        },
        annotationsValues: {
          description: {
            [constants.FIELD_LEVEL_SECURITY]: {
              admin: { editable: true, readable: true },
              standard: { editable: false, readable: false },
            },
          },
        },
      })
    )

    // Verify permissions creation
    expect(mockUpdate.mock.calls.length).toBe(1)
    const profiles = mockUpdate.mock.calls[0][1] as ProfileInfo[]
    const admin = profiles.filter(p => p.fullName === 'Admin').pop() as ProfileInfo
    expect(admin.fieldPermissions.length).toBe(1)
    expect(admin.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(admin.fieldPermissions[0].editable).toBe(true)
    expect(admin.fieldPermissions[0].readable).toBe(true)
    const standard = profiles.filter(p => p.fullName === 'Standard').pop() as ProfileInfo
    expect(standard.fieldPermissions.length).toBe(1)
    expect(standard.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(standard.fieldPermissions[0].editable).toBe(false)
    expect(standard.fieldPermissions[0].readable).toBe(false)
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
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
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
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            description: stringType,
          },
          annotationsValues: {
            description: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
          },
        })
      )
    ).rejects.toEqual(new Error('Failed to update permissions'))
  })

  it('should remove a salesforce metadata component', async () => {
    const mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.delete = mockDelete

    await adapter().remove(
      new ObjectType({
        elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
        fields: {
          description: stringType,
        },
        annotationsValues: {
          [constants.API_NAME]: 'Test__c',
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
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          annotationsValues: {
            [constants.API_NAME]: 'Test__c',
          },
        })
      )
    ).rejects.toEqual(new Error('Failed to remove Test__c'))
  })

  describe('Update operation tests', () => {
    let mockCreate: jest.Mock<unknown>
    let mockDelete: jest.Mock<unknown>
    let mockUpdate: jest.Mock<unknown>
    beforeEach(() => {
      mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
      mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
      mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
      SalesforceClient.prototype.create = mockCreate
      SalesforceClient.prototype.delete = mockDelete
      SalesforceClient.prototype.update = mockUpdate
    })

    it('should fail an update of a salesforce metadata component if the fullnames are not the same', async () => {
      expect(
        adapter().update(
          new ObjectType({
            elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test2' }),
            fields: {
              description: stringType,
            },
            annotationsValues: {
              required: false,
              _default: 'test',
              label: 'test label',
              [constants.API_NAME]: 'Test2__c',
            },
          }),
          new ObjectType({
            elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
            fields: {
              address: stringType,
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
      const result = await adapter().update(
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            description: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: stringType,
          },
          annotationsValues: {
            label: 'test2 label',
            address: {
              label: 'test2 label',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls.length).toBe(1)
      // Update is called twice, once for updating the object, and the second
      // time for updating the permissions
      expect(mockUpdate.mock.calls.length).toBe(2)
    })

    it("should only create new fields when the new object's change is only new fields", async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: stringType,
            banana: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            address: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
            banana: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
          },
        }),
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: stringType,
            banana: stringType,
            description: stringType,
            apple: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test2',
            label: 'test2 label',
            address: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
            banana: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
            description: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
            apple: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls.length).toBe(0)
      // Update is called twice, once for updating the object, and the second
      // time for updating the permissions
      expect(mockUpdate.mock.calls.length).toBe(2)
      // Verify the custom fields creation
      const fields = mockCreate.mock.calls[0][1]
      expect(fields.length).toBe(2)
      expect(fields[0].fullName).toBe('Test__c.Description__c')
      expect(fields[0].type).toBe('Text')
      expect(fields[0].length).toBe(80)
      expect(fields[0].required).toBe(false)
      expect(fields[1].fullName).toBe('Test__c.Apple__c')
      // Verify the field permissions update
      const profileInfo = mockUpdate.mock.calls[0][1][0]
      expect(profileInfo.fullName).toBe('Admin')
      expect(profileInfo.fieldPermissions.length).toBe(2)
      expect(profileInfo.fieldPermissions[0].field).toBe('Test__c.Description__c')
      expect(profileInfo.fieldPermissions[0].editable).toBe(true)
      expect(profileInfo.fieldPermissions[0].readable).toBe(true)
      expect(profileInfo.fieldPermissions[1].field).toBe('Test__c.Apple__c')
    })

    it('should only delete fields when the only change in the new object is that some fields no longer appear', async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: stringType,
            banana: stringType,
            description: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            address: {
              [constants.API_NAME]: 'Address__c',
            },
            banana: {
              [constants.API_NAME]: 'Banana__c',
            },
            description: {
              [constants.API_NAME]: 'Description__c',
            },
          },
        }),
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            description: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test2',
            label: 'test2 label',
            description: {
              [constants.API_NAME]: 'Description__c',
            },
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(0)
      expect(mockDelete.mock.calls.length).toBe(1)
      expect(mockUpdate.mock.calls.length).toBe(1)
      // Verify the custom fields deletion
      const fields = mockDelete.mock.calls[0][1]
      expect(fields.length).toBe(2)
      expect(fields[0]).toBe('Test__c.Address__c')
      expect(fields[1]).toBe('Test__c.Banana__c')
    })

    it('should both create & delete fields when some fields no longer appear in the new object and some fields are new', async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: stringType,
            banana: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            address: {
              [constants.API_NAME]: 'Address__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
            banana: {
              [constants.API_NAME]: 'Banana__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
          },
        }),
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            banana: stringType,
            description: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test2',
            label: 'test2 label',
            banana: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
            description: {
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
            },
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls.length).toBe(1)
      // Update is called twice, once for updating the object, and the second
      // time for updating the permissions
      expect(mockUpdate.mock.calls.length).toBe(2)
      // Verify the custom fields creation
      const addedFields = mockCreate.mock.calls[0][1]
      expect(addedFields.length).toBe(1)
      const field = addedFields[0]
      expect(field.fullName).toBe('Test__c.Description__c')
      expect(field.type).toBe('Text')
      expect(field.length).toBe(80)
      expect(field.required).toBe(false)
      // Verify the field permissions update
      const profileInfo = mockUpdate.mock.calls[0][1][0]
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

    it('should update the annotation values of the metadata object', async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            description: stringType,
          },
          annotationsValues: {
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            description: stringType,
          },
          annotationsValues: {
            label: 'test2 label',
            [constants.API_NAME]: 'Test__c',
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(0)
      expect(mockDelete.mock.calls.length).toBe(0)
      expect(mockUpdate.mock.calls.length).toBe(1)
      // Verify the annotationValues update
      // Verify the custom fields creation
      const objectSentForUpdate = mockUpdate.mock.calls[0][1]
      expect(objectSentForUpdate.fullName).toBe('Test__c')
      expect(objectSentForUpdate.label).toBe('test2 label')
    })

    it("should update the remaining fields' annotation values of the metadata object", async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            address: stringType,
            banana: stringType,
            cat: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            address: {
              [constants.API_NAME]: 'Address__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              [constants.LABEL]: 'Address',
            },
            banana: {
              [constants.API_NAME]: 'Banana__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              [constants.LABEL]: 'Banana',
            },
            cat: {
              [constants.API_NAME]: 'Cat__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              [constants.LABEL]: 'Cat',
            },
          },
        }),
        new ObjectType({
          elemID: new ElemID({ adapter: constants.SALESFORCE, name: 'test' }),
          fields: {
            banana: stringType,
            cat: stringType,
            description: stringType,
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            banana: {
              [constants.API_NAME]: 'Banana__c',
              // eslint-disable-next-line max-len
              [constants.FIELD_LEVEL_SECURITY]: { Standard: { editable: false, readable: true } },
              [constants.LABEL]: 'Banana Split',
            },
            cat: {
              [constants.API_NAME]: 'Cat__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              [constants.LABEL]: 'Cat',
            },
            description: {
              [constants.API_NAME]: 'Description__c',
              [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              [constants.LABEL]: 'Description',
            },
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls.length).toBe(1)
      // Update is called twice, once for updating the object, and the second
      // time for updating the permissions
      expect(mockUpdate.mock.calls.length).toBe(3)
      // Verify the custom fields creation
      const addedFields = mockCreate.mock.calls[0][1]
      expect(addedFields.length).toBe(1)
      const field = addedFields[0]
      expect(field.fullName).toBe('Test__c.Description__c')
      expect(field.type).toBe('Text')
      expect(field.length).toBe(80)
      expect(field.required).toBe(false)
      // Verify the field permissions creation
      const newProfileInfo = mockUpdate.mock.calls[1][1][0]
      expect(newProfileInfo.fullName).toBe('Admin')
      expect(newProfileInfo.fieldPermissions.length).toBe(1)
      expect(newProfileInfo.fieldPermissions[0].field).toBe('Test__c.Description__c')
      expect(newProfileInfo.fieldPermissions[0].editable).toBe(true)
      expect(newProfileInfo.fieldPermissions[0].readable).toBe(true)
      // Verify the field permissions change
      const changedProfileInfo = mockUpdate.mock.calls[0][1][0]
      expect(changedProfileInfo.fullName).toBe('Standard')
      expect(changedProfileInfo.fieldPermissions.length).toBe(1)
      expect(changedProfileInfo.fieldPermissions[0].field).toBe('Test__c.Banana__c')
      expect(changedProfileInfo.fieldPermissions[0].editable).toBe(false)
      expect(changedProfileInfo.fieldPermissions[0].readable).toBe(true)
      // Verify the custom field label change
      const changedObject = mockUpdate.mock.calls[2][1]
      expect(changedObject.fields[0].label).toBe('Banana Split')
      // Verify the custom fields deletion
      const deletedFields = mockDelete.mock.calls[0][1]
      expect(deletedFields.length).toBe(1)
      expect(deletedFields[0]).toBe('Test__c.Address__c')
    })
  })
})
