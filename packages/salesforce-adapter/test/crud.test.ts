import {
  ObjectType,
  PrimitiveType,
  ElemID,
  PrimitiveTypes,
  InstanceElement,
  Field,
} from 'adapter-api'
import { ProfileInfo } from '../src/client/types'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client/client'
import * as constants from '../src/constants'

jest.mock('../src/client/client')

describe('Test SalesforceAdapter CRUD', () => {
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

  const stringType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })

  const mockElemID = new ElemID(constants.SALESFORCE, 'test')

  it('should add new salesforce type', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.update = jest.fn().mockImplementationOnce(() => ({ success: true }))

    const result = await adapter().add(
      new ObjectType({
        elemID: mockElemID,
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              required: false,
              _default: 'test',
              label: 'test label',
            },
          ),
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
  })

  it('should add new salesforce type with picklist field', async () => {
    const mockCreate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.create = mockCreate
    SalesforceClient.prototype.update = jest.fn().mockImplementationOnce(() => ({ success: true }))

    await adapter().add(
      new ObjectType({
        elemID: mockElemID,
        fields: {
          state:
            new Field(
              mockElemID,
              'state',
              new PrimitiveType({
                elemID: new ElemID(constants.SALESFORCE, 'picklist'),
                primitive: PrimitiveTypes.STRING,
              }),
              {
                required: false,
                _default: 'NEW',
                label: 'test label',
                values: ['NEW', 'OLD'],
              },
            ),
        },
      })
    )

    // Verify object creation
    expect(mockCreate.mock.calls.length).toBe(1)
    const object = mockCreate.mock.calls[0][1]
    expect(object.fields.length).toBe(1)
    expect(object.fields[0].fullName).toBe('State__c')
    expect(object.fields[0].type).toBe('Picklist')
    expect(object.fields[0].valueSet.valueSetDefinition.value
      .map((v: {fullName: string}) => v.fullName).join(';'))
      .toBe('NEW;OLD')
  })

  it('should update field permissions upon new salesforce type', async () => {
    SalesforceClient.prototype.create = jest.fn().mockImplementationOnce(() => ({ success: true }))
    const mockUpdate = jest.fn().mockImplementationOnce(() => ({ success: true }))
    SalesforceClient.prototype.update = mockUpdate

    await adapter().add(
      new ObjectType({
        elemID: mockElemID,
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [constants.FIELD_LEVEL_SECURITY]: {
                admin: { editable: true, readable: true },
                standard: { editable: false, readable: false },
              },
            }
          ),
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
          elemID: mockElemID,
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
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
              { [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } } },
            ),
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
        elemID: mockElemID,
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
          ),
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
          elemID: mockElemID,
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
            elemID: new ElemID(constants.SALESFORCE, 'test2'),
            fields: {
              description: new Field(
                mockElemID,
                'description',
                stringType,
              ),
            },
            annotationsValues: {
              required: false,
              _default: 'test',
              label: 'test label',
              [constants.API_NAME]: 'Test2__c',
            },
          }),
          new ObjectType({
            elemID: mockElemID,
            fields: {
              address: new Field(
                mockElemID,
                'address',
                stringType,
              ),
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
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
            ),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: mockElemID,
          fields: {
            address: new Field(
              mockElemID,
              'address',
              stringType,
              {
                label: 'test2 label',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
          },
          annotationsValues: {
            label: 'test2 label',
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
          elemID: mockElemID,
          fields: {
            address: new Field(
              mockElemID,
              'address',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: mockElemID,
          fields: {
            address: new Field(
              mockElemID,
              'address',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
            apple: new Field(
              mockElemID,
              'apple',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
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
          elemID: mockElemID,
          fields: {
            address: new Field(
              mockElemID,
              'address',
              stringType,
              {
                [constants.API_NAME]: 'Address__c',
              },
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.API_NAME]: 'Banana__c',
              },
            ),
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [constants.API_NAME]: 'Description__c',
              },
            ),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [constants.API_NAME]: 'Description__c',
              },
            ),
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
          elemID: mockElemID,
          fields: {
            address: new Field(
              mockElemID,
              'address',
              stringType,
              {
                [constants.API_NAME]: 'Address__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.API_NAME]: 'Banana__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: mockElemID,
          fields: {
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
              },
            ),
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
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
            ),
          },
          annotationsValues: {
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
            ),
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
      // Verify the annotationsValues update
      // Verify the custom fields creation
      const objectSentForUpdate = mockUpdate.mock.calls[0][1]
      expect(objectSentForUpdate.fullName).toBe('Test__c')
      expect(objectSentForUpdate.label).toBe('test2 label')
    })

    it("should update the remaining fields' annotation values of the metadata object", async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: mockElemID,
          fields: {
            address: new Field(
              mockElemID,
              'address',
              stringType,
              {
                [constants.API_NAME]: 'Address__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
                [constants.LABEL]: 'Address',
              },
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.API_NAME]: 'Banana__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
                [constants.LABEL]: 'Banana',
              },
            ),
            cat: new Field(
              mockElemID,
              'cat',
              stringType,
              {
                [constants.API_NAME]: 'Cat__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
                [constants.LABEL]: 'Cat',
              },
            ),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        }),
        new ObjectType({
          elemID: mockElemID,
          fields: {
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.API_NAME]: 'Banana__c',
                // eslint-disable-next-line max-len
                [constants.FIELD_LEVEL_SECURITY]: { Standard: { editable: false, readable: true } },
                [constants.LABEL]: 'Banana Split',
              },
            ),
            cat: new Field(
              mockElemID,
              'cat',
              stringType,
              {
                [constants.API_NAME]: 'Cat__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
                [constants.LABEL]: 'Cat',
              },
            ),
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [constants.API_NAME]: 'Description__c',
                [constants.FIELD_LEVEL_SECURITY]: { admin: { editable: true, readable: true } },
                [constants.LABEL]: 'Description',
              },
            ),
          },
          annotationsValues: {
            required: false,
            _default: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
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
