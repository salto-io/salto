import {
  ObjectType,
  PrimitiveType,
  ElemID,
  PrimitiveTypes,
  InstanceElement,
  Field,
} from 'adapter-api'
import _ from 'lodash'
import { MetadataInfo, SaveResult } from 'jsforce-types'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client/client'
import * as constants from '../src/constants'
import { AspectsManager } from '../src/aspects/aspects'

jest.mock('../src/client/client')
jest.mock('../src/aspects/aspects')

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

  let mockCreate: jest.Mock<unknown>
  let mockDelete: jest.Mock<unknown>
  let mockUpdate: jest.Mock<unknown>
  let mockAspectsUpdate: jest.Mock<unknown>
  let mockAspectsAdd: jest.Mock<unknown>
  let mockAspectsRemove: jest.Mock<unknown>

  beforeEach(() => {
    const saveResultMock = (_type: string, objects: MetadataInfo|MetadataInfo[]):
  SaveResult| SaveResult[] =>
      (_.isArray(objects)
        ? [{ fullName: objects[0].fullName, success: true }]
        : [{ fullName: objects.fullName, success: true }])
    mockCreate = jest.fn().mockImplementationOnce(saveResultMock)
    SalesforceClient.prototype.create = mockCreate
    mockDelete = jest.fn().mockImplementationOnce(saveResultMock)
    SalesforceClient.prototype.delete = mockDelete
    mockUpdate = jest.fn().mockImplementationOnce(saveResultMock)
    SalesforceClient.prototype.update = mockUpdate
    mockAspectsAdd = jest.fn().mockImplementationOnce(_after => Promise.resolve([]))
    AspectsManager.prototype.add = mockAspectsAdd
    mockAspectsUpdate = jest.fn().mockImplementationOnce((_before, _after) =>
      Promise.resolve([]))
    AspectsManager.prototype.update = mockAspectsUpdate
    mockAspectsRemove = jest.fn().mockImplementationOnce(_before => Promise.resolve([]))
    AspectsManager.prototype.remove = mockAspectsRemove
  })

  describe('should add element', () => {
    it('should add simple element', async () => {
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
            formula: new Field(
              mockElemID,
              'formula',
              stringType,
              {
                [constants.LABEL]: 'formula field',
                [constants.FORMULA]: 'my formula',
              },
            ),
          },
        })
      )

      expect(result.annotationsValues[constants.API_NAME]).toBe('Test__c')
      expect(
        result.fields.description.annotationsValues[constants.API_NAME]
      ).toBe('Description__c')

      expect(mockCreate.mock.calls.length).toBe(1)
      const object = mockCreate.mock.calls[0][1]
      expect(object.fullName).toBe('Test__c')
      expect(object.fields.length).toBe(2)
      const [descriptionField, formulaField] = object.fields
      expect(descriptionField.fullName).toBe('Description__c')
      expect(descriptionField.type).toBe('Text')
      expect(descriptionField.length).toBe(80)
      expect(descriptionField.required).toBe(false)
      expect(descriptionField.label).toBe('test label')
      expect(formulaField.fullName).toBe('Formula__c')
      expect(formulaField.type).toBe('Text')
      expect(formulaField).not.toHaveProperty('required')
      expect(formulaField.label).toBe('formula field')
      expect(formulaField.formula).toBe('my formula')

      expect(mockAspectsAdd.mock.calls.length).toBe(1)
    })
    it('should add new salesforce type with picklist field', async () => {
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
  })

  describe('should remove element', () => {
    it('should remove a salesforce metadata component', async () => {
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
      expect(mockAspectsRemove.call.length).toBe(1)
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
  })

  describe('Update operation tests', () => {
    it('should fail an update of a salesforce metadata component if the fullnames are not the same',
      async () => {
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
        expect(mockAspectsUpdate.mock.calls.length).toBe(0)
      })

    it('should perform a successful update', async () => {
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
      expect(mockUpdate.mock.calls.length).toBe(1)
      expect(mockAspectsUpdate.mock.calls.length).toBe(1)
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
            ),
            banana: new Field(
              mockElemID,
              'banana',
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
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
            ),
            description: new Field(
              mockElemID,
              'description',
              stringType,
            ),
            apple: new Field(
              mockElemID,
              'apple',
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
            ),
            description: new Field(
              mockElemID,
              'description',
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

    it("should update the remaining fields' annotation values of the object", async () => {
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
                [constants.LABEL]: 'Address',
              },
            ),
            banana: new Field(
              mockElemID,
              'banana',
              stringType,
              {
                [constants.API_NAME]: 'Banana__c',
                [constants.LABEL]: 'Banana',
              },
            ),
            cat: new Field(
              mockElemID,
              'cat',
              stringType,
              {
                [constants.API_NAME]: 'Cat__c',
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
                [constants.LABEL]: 'Banana Split',
              },
            ),
            cat: new Field(
              mockElemID,
              'cat',
              stringType,
              {
                [constants.API_NAME]: 'Cat__c',
                [constants.LABEL]: 'Cat',
              },
            ),
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [constants.API_NAME]: 'Description__c',
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
      expect(mockUpdate.mock.calls.length).toBe(1)
      // Verify the custom fields creation
      const addedFields = mockCreate.mock.calls[0][1]
      expect(addedFields.length).toBe(1)
      const field = addedFields[0]
      expect(field.fullName).toBe('Test__c.Description__c')
      expect(field.type).toBe('Text')
      expect(field.length).toBe(80)
      expect(field.required).toBe(false)
      // Verify the custom field label change
      const changedObject = mockUpdate.mock.calls[0][1]
      expect(changedObject.fields[0].label).toBe('Banana Split')
      // Verify the custom fields deletion
      const deletedFields = mockDelete.mock.calls[0][1]
      expect(deletedFields.length).toBe(1)
      expect(deletedFields[0]).toBe('Test__c.Address__c')
    })

    it("should properly update the remaining fields' permissions of the metadata object", async () => {
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
            charlie: new Field(
              mockElemID,
              'charlie',
              stringType,
              {
                [constants.API_NAME]: 'Charlie__c',
              },
            ),
            delta: new Field(
              mockElemID,
              'delta',
              stringType,
              {
                [constants.API_NAME]: 'Delta__c',
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
            charlie: new Field(
              mockElemID,
              'charlie',
              stringType,
              {
                [constants.API_NAME]: 'Charlie__c',
              },
            ),
            delta: new Field(
              mockElemID,
              'delta',
              stringType,
              {
                [constants.API_NAME]: 'Delta__c',
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
      expect(mockCreate.mock.calls.length).toBe(0)
      expect(mockDelete.mock.calls.length).toBe(0)
      expect(mockUpdate.mock.calls.length).toBe(1)
    })
  })
})
