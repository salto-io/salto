import {
  ObjectType,
  ElemID,
  InstanceElement,
  Field, BuiltinTypes,
  Type,
} from 'adapter-api'
import _ from 'lodash'
import { MetadataInfo, SaveResult } from 'jsforce-types'
import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client/client'
import * as constants from '../src/constants'
import { Types, sfCase } from '../src/transformer'
import { PROFILE_METADATA_TYPE } from '../src/filters/field_permissions'

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
    a.filters = []
    return a
  }

  const stringType = Types.salesforceDataTypes.text

  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const mockInstanceID = new ElemID(constants.SALESFORCE, 'instance')


  let mockCreate: jest.Mock<unknown>
  let mockDelete: jest.Mock<unknown>
  let mockUpdate: jest.Mock<unknown>
  beforeEach(() => {
    const saveResultMock = async (_type: string, objects: MetadataInfo|MetadataInfo[]):
  Promise<SaveResult| SaveResult[]> =>
      (_.isArray(objects)
        ? [{ fullName: objects[0].fullName, success: true }]
        : [{ fullName: objects.fullName, success: true }])
    mockCreate = jest.fn().mockImplementationOnce(saveResultMock)
    SalesforceClient.prototype.create = mockCreate
    mockDelete = jest.fn().mockImplementationOnce(saveResultMock)
    SalesforceClient.prototype.delete = mockDelete
    mockUpdate = jest.fn().mockImplementationOnce(saveResultMock)
    SalesforceClient.prototype.update = mockUpdate
  })

  describe('Test Add operation', () => {
    it('Should add new instance', async () => {
      SalesforceClient.prototype.create = mockCreate

      const instance = new InstanceElement(mockInstanceID, new ObjectType({
        elemID: mockElemID,
        fields: {
          username: new Field(mockElemID, 'username', BuiltinTypes.STRING),
          password: new Field(mockElemID, 'password', BuiltinTypes.STRING),
          token: new Field(mockElemID, 'token', BuiltinTypes.STRING),
          sandbox: new Field(mockElemID, 'sandbox', BuiltinTypes.BOOLEAN),
        },
        annotations: {},
        annotationsValues: { [constants.METADATA_TYPE]: 'Flow' },
      }),
      {
        token: 'instanceTest',
      })

      const result = await adapter().add(instance) as InstanceElement

      expect(result).toBeInstanceOf(InstanceElement)
      expect(result).toBe(instance)
      expect(result.elemID.name).toBe(mockInstanceID.name)
      expect(result.value.token).toBeDefined()
      expect(result.value.token).toBe('instanceTest')
      expect(result.value.Token).toBeUndefined()

      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockCreate.mock.calls[0].length).toBe(2)
      expect(mockCreate.mock.calls[0][0]).toBe('Flow')
      expect(mockCreate.mock.calls[0][1].fullName).toBe(sfCase(mockInstanceID.name))
      expect(mockCreate.mock.calls[0][1].token).toBeDefined()
      expect(mockCreate.mock.calls[0][1].token).toBe('instanceTest')
    })

    it('should fail add new instance', async () => {
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
          new InstanceElement(mockInstanceID, new ObjectType({
            elemID: mockElemID,
            fields: {},
            annotations: {},
            annotationsValues: {},
          }),
          {})
        )
      ).rejects.toEqual(new Error('Failed to add Test__c\nAdditional message'))
    })

    it('Should add new element', async () => {
      const result = await adapter().add(
        new ObjectType({
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
              {
                [Type.REQUIRED]: false,
                [Type.DEFAULT]: 'test',
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
      ) as ObjectType

      // Verify object creation
      expect(result).toBeInstanceOf(ObjectType)
      expect(result.getAnnotationsValues()[constants.API_NAME]).toBe('Test__c')
      expect(
        result.fields.description.getAnnotationsValues()[constants.API_NAME]
      ).toBe('Description__c')
      expect(result.getAnnotationsValues()[constants.METADATA_TYPE]).toBe(constants.CUSTOM_OBJECT)

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
    })
    it('Should add new salesforce type with picklist field', async () => {
      await adapter().add(
        new ObjectType({
          elemID: mockElemID,
          fields: {
            state:
              new Field(
                mockElemID,
                'state',
                Types.salesforceDataTypes.picklist,
                {
                  [Type.REQUIRED]: false,
                  [Type.DEFAULT]: 'NEW',
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

    it('Should add new salesforce type with different field types', async () => {
      await adapter().add(
        new ObjectType({
          elemID: mockElemID,
          fields: {
            alpha: new Field(
              mockElemID,
              'currency',
              Types.salesforceDataTypes.currency,
              {
                [constants.LABEL]: 'Currency description label',
                [constants.FIELD_ANNOTATIONS.SCALE]: 3,
                [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
              },
            ),
            bravo: new Field(
              mockElemID,
              'auto',
              Types.salesforceDataTypes.autonumber,
              {
                [constants.LABEL]: 'Autonumber description label',
                [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
              },
            ),
            charlie: new Field(
              mockElemID,
              'date',
              Types.salesforceDataTypes.date,
              {
                [constants.LABEL]: 'Date description label',
                [Type.DEFAULT]: 'Today() + 7',
              },
            ),
            delta: new Field(
              mockElemID,
              'time',
              Types.salesforceDataTypes.time,
              {
                [constants.LABEL]: 'Time description label',
                [Type.DEFAULT]: 'TIMENOW() + 5',
              },
            ),
            echo: new Field(
              mockElemID,
              'datetime',
              Types.salesforceDataTypes.datetime,
              {
                [constants.LABEL]: 'DateTime description label',
                [Type.DEFAULT]: 'Now() + 7',
              },
            ),
            foxtrot: new Field(
              mockElemID,
              'email',
              Types.salesforceDataTypes.email,
              {
                [constants.LABEL]: 'Email description label',
                [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
                [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
              },
            ),
            golf: new Field(
              mockElemID,
              'location',
              Types.salesforceDataTypes.location,
              {
                [constants.LABEL]: 'Location description label',
                [constants.FIELD_ANNOTATIONS.SCALE]: 2,
                [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
              },
            ),
            hotel: new Field(
              mockElemID,
              'multipicklist',
              Types.salesforceDataTypes.multipicklist,
              {
                [constants.LABEL]: 'Multipicklist description label',
                values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
                [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
              },
            ),
            india: new Field(
              mockElemID,
              'percent',
              Types.salesforceDataTypes.percent,
              {
                [constants.LABEL]: 'Percent description label',
                [constants.FIELD_ANNOTATIONS.SCALE]: 3,
                [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
              },
            ),
            juliett: new Field(
              mockElemID,
              'phone',
              Types.salesforceDataTypes.phone,
              {
                [constants.LABEL]: 'Phone description label',
              },
            ),
            kilo: new Field(
              mockElemID,
              'longtextarea',
              Types.salesforceDataTypes.longtextarea,
              {
                [constants.LABEL]: 'LongTextArea description label',
                [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
              },
            ),
            lima: new Field(
              mockElemID,
              'richtextarea',
              Types.salesforceDataTypes.richtextarea,
              {
                [constants.LABEL]: 'RichTextArea description label',
                [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
              },
            ),
            mike: new Field(
              mockElemID,
              'textarea',
              Types.salesforceDataTypes.textarea,
              {
                [constants.LABEL]: 'TextArea description label',
              },
            ),
            november: new Field(
              mockElemID,
              'encryptedtext',
              Types.salesforceDataTypes.encryptedtext,
              {
                [constants.LABEL]: 'EncryptedText description label',
                [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'creditCard',
                [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
                [constants.FIELD_ANNOTATIONS.LENGTH]: 35,
              },
            ),
            oscar: new Field(
              mockElemID,
              'url',
              Types.salesforceDataTypes.url,
              {
                [constants.LABEL]: 'Url description label',
              },
            ),
            papa: new Field(
              mockElemID,
              'picklist',
              Types.salesforceDataTypes.picklist,
              {
                [constants.LABEL]: 'Picklist description label',
                values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
              },
            ),
            quebec: new Field(
              mockElemID,
              'text',
              Types.salesforceDataTypes.text,
              {
                [constants.LABEL]: 'Text description label',
                values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
                [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
                [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
                [constants.FIELD_ANNOTATIONS.LENGTH]: 90,
              },
            ),
            Romeo: new Field(
              mockElemID,
              'number',
              Types.salesforceDataTypes.number,
              {
                [constants.LABEL]: 'Number description label',
                [constants.FIELD_ANNOTATIONS.SCALE]: 12,
                [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
                [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              },
            ),
          },
        })
      )

      // Verify object creation
      expect(mockCreate.mock.calls.length).toBe(1)
      const object = mockCreate.mock.calls[0][1]
      expect(object.fields.length).toBe(18)
      // Currency
      expect(object.fields[0].fullName).toBe('Currency__c')
      expect(object.fields[0].type).toBe('Currency')
      expect(object.fields[0].label).toBe('Currency description label')
      expect(object.fields[0].scale).toBe(3)
      expect(object.fields[0].precision).toBe(18)
      // Autonumber
      expect(object.fields[1].fullName).toBe('Auto__c')
      expect(object.fields[1].type).toBe('AutoNumber')
      expect(object.fields[1].label).toBe('Autonumber description label')
      expect(object.fields[1].displayFormat).toBe('ZZZ-{0000}')
      // Date
      expect(object.fields[2].fullName).toBe('Date__c')
      expect(object.fields[2].type).toBe('Date')
      expect(object.fields[2].label).toBe('Date description label')
      expect(object.fields[2].defaultValue).toBe('Today() + 7')
      // Time
      expect(object.fields[3].fullName).toBe('Time__c')
      expect(object.fields[3].type).toBe('Time')
      expect(object.fields[3].label).toBe('Time description label')
      expect(object.fields[3].defaultValue).toBe('TIMENOW() + 5')
      // Datetime
      expect(object.fields[4].fullName).toBe('Datetime__c')
      expect(object.fields[4].type).toBe('DateTime')
      expect(object.fields[4].label).toBe('DateTime description label')
      expect(object.fields[4].defaultValue).toBe('Now() + 7')
      // Email
      expect(object.fields[5].fullName).toBe('Email__c')
      expect(object.fields[5].type).toBe('Email')
      expect(object.fields[5].label).toBe('Email description label')
      expect(object.fields[5].unique).toBe(true)
      expect(object.fields[5].caseSensitive).toBe(true)
      // Location
      expect(object.fields[6].fullName).toBe('Location__c')
      expect(object.fields[6].type).toBe('Location')
      expect(object.fields[6].label).toBe('Location description label')
      expect(object.fields[6].displayLocationInDecimal).toBe(true)
      expect(object.fields[6].scale).toBe(2)
      // Multipicklist
      expect(object.fields[7].fullName).toBe('Multipicklist__c')
      expect(object.fields[7].type).toBe('MultiselectPicklist')
      expect(object.fields[7].label).toBe('Multipicklist description label')
      expect(object.fields[7].visibleLines).toBe(4)
      expect(object.fields[7].valueSet.valueSetDefinition.value
        .map((v: {fullName: string}) => v.fullName).join(';'))
        .toBe('DO;RE;MI;FA;SOL;LA;SI')
      // Percent
      expect(object.fields[8].fullName).toBe('Percent__c')
      expect(object.fields[8].type).toBe('Percent')
      expect(object.fields[8].label).toBe('Percent description label')
      expect(object.fields[8].scale).toBe(3)
      expect(object.fields[8].precision).toBe(12)
      // Phone
      expect(object.fields[9].fullName).toBe('Phone__c')
      expect(object.fields[9].type).toBe('Phone')
      expect(object.fields[9].label).toBe('Phone description label')
      // Longtextarea
      expect(object.fields[10].fullName).toBe('Longtextarea__c')
      expect(object.fields[10].type).toBe('LongTextArea')
      expect(object.fields[10].label).toBe('LongTextArea description label')
      expect(object.fields[10].visibleLines).toBe(5)
      expect(object.fields[11].length).toBe(32768)
      // Richtextarea
      expect(object.fields[11].fullName).toBe('Richtextarea__c')
      expect(object.fields[11].type).toBe('Html')
      expect(object.fields[11].label).toBe('RichTextArea description label')
      expect(object.fields[11].visibleLines).toBe(27)
      expect(object.fields[11].length).toBe(32768)
      // Textarea
      expect(object.fields[12].fullName).toBe('Textarea__c')
      expect(object.fields[12].type).toBe('TextArea')
      expect(object.fields[12].label).toBe('TextArea description label')
      // EncryptedText
      expect(object.fields[13].fullName).toBe('Encryptedtext__c')
      expect(object.fields[13].type).toBe('EncryptedText')
      expect(object.fields[13].label).toBe('EncryptedText description label')
      expect(object.fields[13].maskChar).toBe('X')
      expect(object.fields[13].maskType).toBe('creditCard')
      expect(object.fields[13].length).toBe(35)
      // Url
      expect(object.fields[14].fullName).toBe('Url__c')
      expect(object.fields[14].type).toBe('Url')
      expect(object.fields[14].label).toBe('Url description label')
      // Picklist
      expect(object.fields[15].fullName).toBe('Picklist__c')
      expect(object.fields[15].type).toBe('Picklist')
      expect(object.fields[15].label).toBe('Picklist description label')
      expect(object.fields[15].valueSet.valueSetDefinition.value
        .map((v: {fullName: string}) => v.fullName).join(';'))
        .toBe('DO;RE;MI;FA;SOL;LA;SI')
      // Text
      expect(object.fields[16].fullName).toBe('Text__c')
      expect(object.fields[16].type).toBe('Text')
      expect(object.fields[16].label).toBe('Text description label')
      expect(object.fields[16].unique).toBe(true)
      expect(object.fields[16].caseSensitive).toBe(true)
      expect(object.fields[16].length).toBe(90)
      // Number
      expect(object.fields[17].fullName).toBe('Number__c')
      expect(object.fields[17].type).toBe('Number')
      expect(object.fields[17].label).toBe('Number description label')
      expect(object.fields[17].unique).toBe(true)
      expect(object.fields[17].scale).toBe(12)
      expect(object.fields[17].precision).toBe(8)
    })

    it('Should fail add new salesforce type', async () => {
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

  describe('Test Remove operation', () => {
    it('Should remove a instance', async () => {
      mockDelete = jest.fn().mockImplementationOnce(() => ({ success: true }))
      SalesforceClient.prototype.delete = mockDelete

      await adapter().remove(
        new InstanceElement(mockInstanceID, new ObjectType({
          elemID: mockElemID,
          fields: {
            username: new Field(mockElemID, 'username', BuiltinTypes.STRING),
            password: new Field(mockElemID, 'password', BuiltinTypes.STRING),
            token: new Field(mockElemID, 'token', BuiltinTypes.STRING),
            sandbox: new Field(mockElemID, 'sandbox', BuiltinTypes.BOOLEAN),
          },
          annotations: {},
          annotationsValues: { [constants.METADATA_TYPE]: 'Flow' },
        }),
        {})
      )

      expect(mockDelete.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls[0][0]).toBe('Flow')
      expect(mockDelete.mock.calls[0][1]).toBe('Instance')
    })

    it('Should remove a salesforce metadata component', async () => {
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
      SalesforceClient.prototype.delete = jest.fn().mockImplementationOnce(async () => ({
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

  describe('Test Update operation', () => {
    it('Should fail an update of a salesforce metadata instance, fullNames are not the same',
      async () => {
        await expect(
          adapter().update(
            new InstanceElement(mockInstanceID, new ObjectType({
              elemID: mockElemID,
              fields: {
              },
              annotations: {},
              annotationsValues: {
                [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
              },
            }),
            {}),
            new InstanceElement(new ElemID(constants.SALESFORCE, 'wrong'), new ObjectType({
              elemID: mockElemID,
              fields: {
              },
              annotations: {},
              annotationsValues: {
                [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
              },
            }),
            {})
          )
        ).rejects.toThrow()

        expect(mockUpdate.mock.calls.length).toBe(0)
      })

    it('Should fail an update of SObject when the fullNames are not the same',
      async () => {
        await expect(
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
                [Type.REQUIRED]: false,
                [Type.DEFAULT]: 'test',
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
                [Type.REQUIRED]: false,
                [Type.DEFAULT]: 'test2',
                label: 'test2 label',
              },
            })
          )
        ).rejects.toThrow()

        expect(mockCreate.mock.calls.length).toBe(0)
        expect(mockDelete.mock.calls.length).toBe(0)
        expect(mockUpdate.mock.calls.length).toBe(0)
      })

    it('Should perform a successful instance update',
      async () => {
        await expect(
          adapter().update(
            new InstanceElement(mockInstanceID, new ObjectType({
              elemID: mockElemID,
              fields: {
              },
              annotations: {},
              annotationsValues: {
                [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
              },
            }),
            {
              tabVisibilities: [
                {
                  tab: 'standard-Account',
                  visibility: 'DefaultOff',
                },
              ],
              userPermissions: [
                {
                  enabled: false,
                  name: 'ConvertLeads',
                },
              ],
              fieldPermissions: [
                {
                  field: 'Lead.Fax',
                  readable: false,
                  editable: false,
                },
              ],
              description: 'old unit test instance profile',
            },),
            new InstanceElement(mockInstanceID, new ObjectType({
              elemID: mockElemID,
              fields: {
              },
              annotations: {},
              annotationsValues: {
                [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
              },
            }),
            {
              userPermissions: [
                {
                  enabled: false,
                  name: 'ConvertLeads',
                },
              ],
              fieldPermissions: [
                {
                  field: 'Lead.Fax',
                  readable: false,
                  editable: false,
                },
                {
                  editable: false,
                  field: 'Account.AccountNumber',
                  readable: false,
                },
              ],
              tabVisibilities: [
                {
                  tab: 'standard-Account',
                  visibility: 'DefaultOff',
                },
              ],
              applicationVisibilities: [
                {
                  application: 'standard__ServiceConsole',
                  default: false,
                  visible: true,
                },
              ],
              description: 'new unit test instance profile',
            },)
          )
        ).resolves.toBeInstanceOf(InstanceElement)

        expect(mockUpdate.mock.calls.length).toBe(1)
        expect(mockUpdate.mock.calls[0][0]).toEqual(PROFILE_METADATA_TYPE)
        expect(mockUpdate.mock.calls[0][1].fullName).toEqual(sfCase(mockInstanceID.name))
        expect(mockUpdate.mock.calls[0][1].description).toEqual('new unit test instance profile')
        expect(mockUpdate.mock.calls[0][1].userPermissions).toBeUndefined()
        expect(mockUpdate.mock.calls[0][1].fieldPermissions).toHaveLength(2)
        expect(mockUpdate.mock.calls[0][1].applicationVisibilities).toHaveLength(1)
        expect(mockUpdate.mock.calls[0][1].tabVisibilities).toBeUndefined()
      })

    it('Should perform a successful Object update', async () => {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
    })

    it("Should only create new fields when the new object's change is only new fields", async () => {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
            label: 'test label',
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls.length).toBe(0)
      expect(mockUpdate.mock.calls.length).toBe(0)
      // Verify the custom fields creation
      const fields = mockCreate.mock.calls[0][1]
      expect(fields.length).toBe(2)
      expect(fields[0].fullName).toBe('Test__c.Description__c')
      expect(fields[0].type).toBe('Text')
      expect(fields[0].length).toBe(80)
      expect(fields[0].required).toBe(false)
      expect(fields[1].fullName).toBe('Test__c.Apple__c')
    })

    it('Should only delete fields when the only change in the new object is that some fields no longer appear', async () => {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test2',
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

    it('Should both create & delete fields when some fields no longer appear in the new object and some fields are new', async () => {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
            label: 'test label',
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(1)
      expect(mockDelete.mock.calls.length).toBe(1)
      expect(mockUpdate.mock.calls.length).toBe(0)
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

    it('Should update the annotation values of the metadata object', async () => {
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

    it("Should update the remaining fields' annotation values of the object", async () => {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
      expect(changedObject[0].label).toBe('Banana Split')
      // Verify the custom fields deletion
      const deletedFields = mockDelete.mock.calls[0][1]
      expect(deletedFields.length).toBe(1)
      expect(deletedFields[0]).toBe('Test__c.Address__c')
    })

    it('Should not update the object if remaining fields did not change', async () => {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
          },
          annotationsValues: {
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(0)
      expect(mockDelete.mock.calls.length).toBe(0)
      expect(mockUpdate.mock.calls.length).toBe(0)
    })

    it('Should perform 2 updates on the object if object annotations change and fields that remain change', async () => {
      const result = await adapter().update(
        new ObjectType({
          elemID: mockElemID,
          fields: {
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
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test',
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
                [constants.LABEL]: 'Banana Split',
              },
            ),
          },
          annotationsValues: {
            [Type.REQUIRED]: false,
            [Type.DEFAULT]: 'test2',
            label: 'test2 label',
          },
        })
      )

      expect(result).toBeInstanceOf(ObjectType)
      expect(mockCreate.mock.calls.length).toBe(0)
      expect(mockDelete.mock.calls.length).toBe(0)
      expect(mockUpdate.mock.calls.length).toBe(2)
      // Verify the custom field update
      const updatedFields = mockUpdate.mock.calls[0][1]
      expect(updatedFields.length).toBe(1)
      const field = updatedFields[0]
      expect(field.fullName).toBe('Test__c.Banana__c')
      expect(field.type).toBe('Text')
      expect(field.label).toBe('Banana Split')
      expect(field.length).toBe(80)
      expect(field.required).toBe(false)
      // Verify the object update
      const updatedObject = mockUpdate.mock.calls[1][1]
      expect(updatedObject.fullName).toBe('Test__c')
      expect(updatedObject.label).toBe('test2 label')
      expect(updatedObject.fields).toBeUndefined()
    })
  })
})
