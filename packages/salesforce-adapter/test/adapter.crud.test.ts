import _ from 'lodash'
import { collections } from '@salto/lowerdash'
import { ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes,
  CORE_ANNOTATIONS } from 'adapter-api'
import {
  MetadataInfo, SaveResult, DeployResult, DeployDetails,
} from 'jsforce'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { Types } from '../src/transformers/transformer'
import Connection from '../src/client/jsforce'
import mockAdapter from './adapter'
import { ASSIGNMENT_RULES_TYPE_ID } from '../src/filters/assignment_rules'
import { createValueSetEntry } from './utils'
import { WORKFLOW_TYPE_ID } from '../src/filters/workflow'

const { makeArray } = collections.array

describe('SalesforceAdapter CRUD', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  const stringType = Types.primitiveDataTypes.Text
  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const mockInstanceName = 'Instance'

  const getDeployResult = (success: boolean, details?: DeployDetails[]): Promise<DeployResult> =>
    Promise.resolve({
      id: '',
      checkOnly: false,
      completedDate: '',
      createdDate: '',
      done: true,
      details,
      lastModifiedDate: '',
      numberComponentErrors: 0,
      numberComponentsDeployed: 0,
      numberComponentsTotal: 0,
      numberTestErrors: 0,
      numberTestsCompleted: 0,
      numberTestsTotal: 0,
      startDate: '',
      status: success ? 'Done' : 'Failed',
      success,
    })

  const deployTypeNames = {
    AssignmentRules: undefined,
    UnsupportedType: undefined,
  }

  let mockUpsert: jest.Mock
  let mockDelete: jest.Mock
  let mockUpdate: jest.Mock
  let mockDeploy: jest.Mock

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        filterCreators: [],
        metadataToRetrieveAndDeploy: deployTypeNames,
      },
    }))

    const saveResultMock = (_type: string, objects: MetadataInfo | MetadataInfo[]):
      Promise<SaveResult[]> => Promise.resolve([
      { fullName: (makeArray(objects)[0] || {}).fullName, success: true },
    ])

    mockUpsert = jest.fn().mockImplementation(saveResultMock)
    connection.metadata.upsert = mockUpsert
    mockDelete = jest.fn().mockImplementation(saveResultMock)
    connection.metadata.delete = mockDelete
    mockUpdate = jest.fn().mockImplementation(saveResultMock)
    connection.metadata.update = mockUpdate

    mockDeploy = jest.fn().mockImplementation(() => ({
      complete: () => Promise.resolve(getDeployResult(true)),
    }))
    connection.metadata.deploy = mockDeploy
  })

  describe('Add operation', () => {
    describe('for an instance element', () => {
      const instance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            username: new Field(mockElemID, 'username', BuiltinTypes.STRING),
            password: new Field(mockElemID, 'password', BuiltinTypes.STRING),
            token: new Field(mockElemID, 'token', BuiltinTypes.STRING),
            sandbox: new Field(mockElemID, 'sandbox', BuiltinTypes.BOOLEAN),
          },
          annotationTypes: {},
          annotations: { [constants.METADATA_TYPE]: 'Flow' },
        }),
        {
          token: 'instanceTest',
        }
      )

      describe('when the request succeeds', () => {
        let result: InstanceElement

        beforeEach(async () => {
          result = await adapter.add(instance) as InstanceElement
        })

        it('Should add new instance', async () => {
          expect(result).toBeInstanceOf(InstanceElement)
          expect(result.elemID).toEqual(instance.elemID)
          expect(result.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(mockInstanceName)
          expect(result.value.token).toBeDefined()
          expect(result.value.token).toBe('instanceTest')
          expect(result.value.Token).toBeUndefined()

          expect(mockUpsert.mock.calls.length).toBe(1)
          expect(mockUpsert.mock.calls[0].length).toBe(2)
          expect(mockUpsert.mock.calls[0][0]).toBe('Flow')
          expect(mockUpsert.mock.calls[0][1]).toHaveLength(1)
          expect(mockUpsert.mock.calls[0][1][0]).toMatchObject({
            fullName: mockInstanceName,
            token: 'instanceTest',
          })
        })
      })

      describe('when the request fails', () => {
        let result: Promise<Element>

        beforeEach(async () => {
          connection.metadata.upsert = jest.fn()
            .mockImplementationOnce(async () => ([{
              success: false,
              fullName: 'Test__c',
              errors: [
                { message: 'Failed to add Test__c' },
                { message: 'Additional message' },
              ],
            }]))

          result = adapter.add(
            new InstanceElement(
              mockInstanceName,
              new ObjectType({
                elemID: mockElemID,
                fields: {},
                annotationTypes: {},
                annotations: {},
              }),
              {},
            )
          )
        })

        it(
          'should reject the promise',
          () => expect(result).rejects.toEqual(new Error('Failed to add Test__c\nAdditional message'))
        )
      })
    })

    describe('for a type element', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.LABEL]: 'test label',
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

      let result: ObjectType

      beforeEach(async () => {
        result = await adapter.add(element) as ObjectType
      })

      it('should add the new element', () => {
        // Verify object creation
        expect(result).toBeInstanceOf(ObjectType)
        expect(result.annotations[constants.API_NAME]).toBe('Test__c')
        expect(
          result.fields.description.annotations[constants.API_NAME]
        ).toBe('Test__c.description__c')
        expect(result.annotations[constants.METADATA_TYPE]).toBe(constants.CUSTOM_OBJECT)

        expect(mockUpsert.mock.calls.length).toBe(1)
        expect(mockUpsert.mock.calls[0][1]).toHaveLength(1)
        const object = mockUpsert.mock.calls[0][1][0]
        expect(object.fullName).toBe('Test__c')
        expect(object.fields.length).toBe(2)
        const [descriptionField, formulaField] = object.fields
        expect(descriptionField.fullName).toBe('description__c')
        expect(descriptionField.type).toBe('Text')
        expect(descriptionField.length).toBe(80)
        expect(descriptionField.required).toBe(false)
        expect(descriptionField.label).toBe('test label')
        expect(formulaField.fullName).toBe('formula__c')
        expect(formulaField.type).toBe('Text')
        expect(formulaField).not.toHaveProperty('required')
        expect(formulaField.label).toBe('formula field')
        expect(formulaField.formula).toBe('my formula')
      })
    })

    describe('for a new salesforce type with a picklist field', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          state: new Field(
            mockElemID,
            'state',
            Types.primitiveDataTypes.Picklist,
            {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('NEW', true),
                createValueSetEntry('OLD'),
              ],
            },
          ),
        },
      })

      let result: ObjectType

      beforeEach(async () => {
        result = await adapter.add(element) as ObjectType
      })

      it('should create the type correctly', () => {
        expect(mockUpsert.mock.calls.length).toBe(1)
        const object = mockUpsert.mock.calls[0][1][0]
        expect(object.fields.length).toBe(1)
        expect(object.fields[0].fullName).toBe('state__c')
        expect(object.fields[0].type).toBe('Picklist')
        expect(object.fields[0].valueSet.valueSetDefinition.value
          .map((v: {fullName: string}) => v.fullName).join(';'))
          .toBe('NEW;OLD')
        const picklistValueNew = object.fields[0].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'NEW')[0]
        expect(picklistValueNew).toBeDefined()
        expect(picklistValueNew.default).toEqual(true)
        const picklistValueOld = object.fields[0].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'OLD')[0]
        expect(picklistValueOld).toBeDefined()
        expect(picklistValueOld.default).toEqual(false)
      })

      it('should return the created element', () => {
        expect(result).toMatchObject(element)
        expect(result.annotations).toBeDefined()
      })
    })

    describe('for a new salesforce type with different field types', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          alpha: new Field(
            mockElemID,
            'currency',
            Types.primitiveDataTypes.Currency,
            {
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
            },
          ),
          bravo: new Field(
            mockElemID,
            'auto',
            Types.primitiveDataTypes.AutoNumber,
            {
              [constants.LABEL]: 'Autonumber description label',
              [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
            },
          ),
          charlie: new Field(
            mockElemID,
            'date',
            Types.primitiveDataTypes.Date,
            {
              [constants.LABEL]: 'Date description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Today() + 7',
            },
          ),
          delta: new Field(
            mockElemID,
            'time',
            Types.primitiveDataTypes.Time,
            {
              [constants.LABEL]: 'Time description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'TIMENOW() + 5',
            },
          ),
          echo: new Field(
            mockElemID,
            'datetime',
            Types.primitiveDataTypes.DateTime,
            {
              [constants.LABEL]: 'DateTime description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Now() + 7',
            },
          ),
          foxtrot: new Field(
            mockElemID,
            'email',
            Types.primitiveDataTypes.Email,
            {
              [constants.LABEL]: 'Email description label',
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
            },
          ),
          golf: new Field(
            mockElemID,
            'location',
            Types.compoundDataTypes.Location,
            {
              [constants.LABEL]: 'Location description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 2,
              [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
            },
          ),
          hotel: new Field(
            mockElemID,
            'multipicklist',
            Types.primitiveDataTypes.MultiselectPicklist,
            {
              [constants.LABEL]: 'Multipicklist description label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('DO'),
                createValueSetEntry('RE', true),
                createValueSetEntry('MI'),
                createValueSetEntry('FA'),
                createValueSetEntry('SOL'),
                createValueSetEntry('LA'),
                createValueSetEntry('SI'),
              ],
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
            },
          ),
          india: new Field(
            mockElemID,
            'percent',
            Types.primitiveDataTypes.Percent,
            {
              [constants.LABEL]: 'Percent description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
            },
          ),
          juliett: new Field(
            mockElemID,
            'phone',
            Types.primitiveDataTypes.Phone,
            {
              [constants.LABEL]: 'Phone description label',
            },
          ),
          kilo: new Field(
            mockElemID,
            'longtextarea',
            Types.primitiveDataTypes.LongTextArea,
            {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
            },
          ),
          lima: new Field(
            mockElemID,
            'richtextarea',
            Types.primitiveDataTypes.Html,
            {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
            },
          ),
          mike: new Field(
            mockElemID,
            'textarea',
            Types.primitiveDataTypes.TextArea,
            {
              [constants.LABEL]: 'TextArea description label',
            },
          ),
          november: new Field(
            mockElemID,
            'encryptedtext',
            Types.primitiveDataTypes.EncryptedText,
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
            Types.primitiveDataTypes.Url,
            {
              [constants.LABEL]: 'Url description label',
            },
          ),
          papa: new Field(
            mockElemID,
            'picklist',
            Types.primitiveDataTypes.Picklist,
            {
              [constants.LABEL]: 'Picklist description label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('DO', true),
                createValueSetEntry('RE'),
                createValueSetEntry('MI'),
                createValueSetEntry('FA'),
                createValueSetEntry('SOL'),
                createValueSetEntry('LA'),
                createValueSetEntry('SI'),
              ],
            },
          ),
          quebec: new Field(
            mockElemID,
            'text',
            Types.primitiveDataTypes.Text,
            {
              [constants.LABEL]: 'Text description label',
              [CORE_ANNOTATIONS.VALUES]: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
              [constants.FIELD_ANNOTATIONS.LENGTH]: 90,
            },
          ),
          Romeo: new Field(
            mockElemID,
            'number',
            Types.primitiveDataTypes.Number,
            {
              [constants.LABEL]: 'Number description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 12,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
            },
          ),
          quest: new Field(
            mockElemID,
            'checkbox',
            Types.primitiveDataTypes.Checkbox,
            {
              [constants.LABEL]: 'Checkbox description label',
              [constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]: true,
            },
          ),
        },
      })

      beforeEach(async () => {
        await adapter.add(element)
      })

      it('should create the element correctly', () => {
        expect(mockUpsert.mock.calls.length).toBe(1)
        expect(mockUpsert.mock.calls[0][1]).toHaveLength(1)
        const object = mockUpsert.mock.calls[0][1][0]
        expect(object.fields.length).toBe(19)
        // Currency
        expect(object.fields[0].fullName).toBe('currency__c')
        expect(object.fields[0].type).toBe('Currency')
        expect(object.fields[0].label).toBe('Currency description label')
        expect(object.fields[0].scale).toBe(3)
        expect(object.fields[0].precision).toBe(18)
        // Autonumber
        expect(object.fields[1].fullName).toBe('auto__c')
        expect(object.fields[1].type).toBe('AutoNumber')
        expect(object.fields[1].label).toBe('Autonumber description label')
        expect(object.fields[1].displayFormat).toBe('ZZZ-{0000}')
        // Date
        expect(object.fields[2].fullName).toBe('date__c')
        expect(object.fields[2].type).toBe('Date')
        expect(object.fields[2].label).toBe('Date description label')
        expect(object.fields[2].defaultValue).toBe('Today() + 7')
        // Time
        expect(object.fields[3].fullName).toBe('time__c')
        expect(object.fields[3].type).toBe('Time')
        expect(object.fields[3].label).toBe('Time description label')
        expect(object.fields[3].defaultValue).toBe('TIMENOW() + 5')
        // Datetime
        expect(object.fields[4].fullName).toBe('datetime__c')
        expect(object.fields[4].type).toBe('DateTime')
        expect(object.fields[4].label).toBe('DateTime description label')
        expect(object.fields[4].defaultValue).toBe('Now() + 7')
        // Email
        expect(object.fields[5].fullName).toBe('email__c')
        expect(object.fields[5].type).toBe('Email')
        expect(object.fields[5].label).toBe('Email description label')
        expect(object.fields[5].unique).toBe(true)
        // Location
        expect(object.fields[6].fullName).toBe('location__c')
        expect(object.fields[6].type).toBe('Location')
        expect(object.fields[6].label).toBe('Location description label')
        expect(object.fields[6].displayLocationInDecimal).toBe(true)
        expect(object.fields[6].scale).toBe(2)
        // Multipicklist
        expect(object.fields[7].fullName).toBe('multipicklist__c')
        expect(object.fields[7].type).toBe('MultiselectPicklist')
        expect(object.fields[7].label).toBe('Multipicklist description label')
        expect(object.fields[7].visibleLines).toBe(4)
        expect(object.fields[7].valueSet.valueSetDefinition.value
          .map((v: {fullName: string}) => v.fullName).join(';'))
          .toBe('DO;RE;MI;FA;SOL;LA;SI')
        const picklistValueRE = object.fields[7].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'RE')[0]
        expect(picklistValueRE).toBeDefined()
        expect(picklistValueRE.default).toEqual(true)
        // Percent
        expect(object.fields[8].fullName).toBe('percent__c')
        expect(object.fields[8].type).toBe('Percent')
        expect(object.fields[8].label).toBe('Percent description label')
        expect(object.fields[8].scale).toBe(3)
        expect(object.fields[8].precision).toBe(12)
        // Phone
        expect(object.fields[9].fullName).toBe('phone__c')
        expect(object.fields[9].type).toBe('Phone')
        expect(object.fields[9].label).toBe('Phone description label')
        // Longtextarea
        expect(object.fields[10].fullName).toBe('longtextarea__c')
        expect(object.fields[10].type).toBe('LongTextArea')
        expect(object.fields[10].label).toBe('LongTextArea description label')
        expect(object.fields[10].visibleLines).toBe(5)
        expect(object.fields[11].length).toBe(32768)
        // Richtextarea
        expect(object.fields[11].fullName).toBe('richtextarea__c')
        expect(object.fields[11].type).toBe('Html')
        expect(object.fields[11].label).toBe('RichTextArea description label')
        expect(object.fields[11].visibleLines).toBe(27)
        expect(object.fields[11].length).toBe(32768)
        // Textarea
        expect(object.fields[12].fullName).toBe('textarea__c')
        expect(object.fields[12].type).toBe('TextArea')
        expect(object.fields[12].label).toBe('TextArea description label')
        // EncryptedText
        expect(object.fields[13].fullName).toBe('encryptedtext__c')
        expect(object.fields[13].type).toBe('EncryptedText')
        expect(object.fields[13].label).toBe('EncryptedText description label')
        expect(object.fields[13].maskChar).toBe('X')
        expect(object.fields[13].maskType).toBe('creditCard')
        expect(object.fields[13].length).toBe(35)
        // Url
        expect(object.fields[14].fullName).toBe('url__c')
        expect(object.fields[14].type).toBe('Url')
        expect(object.fields[14].label).toBe('Url description label')
        // Picklist
        expect(object.fields[15].fullName).toBe('picklist__c')
        expect(object.fields[15].type).toBe('Picklist')
        expect(object.fields[15].label).toBe('Picklist description label')
        expect(object.fields[15].valueSet.valueSetDefinition.value
          .map((v: {fullName: string}) => v.fullName).join(';'))
          .toBe('DO;RE;MI;FA;SOL;LA;SI')
        const picklistValueDO = object.fields[15].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'DO')[0]
        expect(picklistValueDO).toBeDefined()
        expect(picklistValueDO.default).toEqual(true)
        // Text
        expect(object.fields[16].fullName).toBe('text__c')
        expect(object.fields[16].type).toBe('Text')
        expect(object.fields[16].label).toBe('Text description label')
        expect(object.fields[16].unique).toBe(true)
        expect(object.fields[16].caseSensitive).toBe(true)
        expect(object.fields[16].length).toBe(90)
        // Number
        expect(object.fields[17].fullName).toBe('number__c')
        expect(object.fields[17].type).toBe('Number')
        expect(object.fields[17].label).toBe('Number description label')
        expect(object.fields[17].unique).toBe(true)
        expect(object.fields[17].scale).toBe(12)
        expect(object.fields[17].precision).toBe(8)
        // Checkbox
        expect(object.fields[18].fullName).toBe('checkbox__c')
        expect(object.fields[18].type).toBe('Checkbox')
        expect(object.fields[18].label).toBe('Checkbox description label')
        expect(object.fields[18].defaultValue).toBe(true)
      })
    })

    describe('for a workflow instance element', () => {
      const workflowInstance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: WORKFLOW_TYPE_ID,
          annotations: {
            [constants.METADATA_TYPE]: constants.WORKFLOW_METADATA_TYPE,
          },
        }), {}
      )

      it('should not add the instance in the main flow', async () => {
        await adapter.add(workflowInstance)
        expect(mockUpsert.mock.calls.length).toBe(0)
      })
    })
  })

  describe('Remove operation', () => {
    describe('when the request succeeds', () => {
      beforeEach(() => {
        mockDelete = jest.fn().mockImplementationOnce(async () => ([{ success: true }]))
        connection.metadata.delete = mockDelete
      })

      describe('for an instance element', () => {
        const element = new InstanceElement(
          mockInstanceName,
          new ObjectType({
            elemID: mockElemID,
            fields: {
              username: new Field(mockElemID, 'username', BuiltinTypes.STRING),
              password: new Field(mockElemID, 'password', BuiltinTypes.STRING),
              token: new Field(mockElemID, 'token', BuiltinTypes.STRING),
              sandbox: new Field(mockElemID, 'sandbox', BuiltinTypes.BOOLEAN),
              [constants.INSTANCE_FULL_NAME_FIELD]:
                new Field(mockElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
            },
            annotationTypes: {},
            annotations: { [constants.METADATA_TYPE]: 'Flow' },
          }),
          { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName },
        )

        beforeEach(async () => {
          await adapter.remove(element)
        })

        it('should call the connection methods correctly', () => {
          expect(mockDelete.mock.calls.length).toBe(1)
          expect(mockDelete.mock.calls[0][0]).toBe('Flow')
          expect(mockDelete.mock.calls[0][1][0]).toBe('Instance')
        })
      })

      describe('for a type element', () => {
        const element = new ObjectType({
          elemID: mockElemID,
          fields: {
            description: new Field(
              mockElemID,
              'description',
              stringType,
            ),
          },
          annotations: {
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          await adapter.remove(element)
        })

        it('should call the connection methods correctly', () => {
          expect(mockDelete.mock.calls.length).toBe(1)
          const fullName = mockDelete.mock.calls[0][1][0]
          expect(fullName).toBe('Test__c')
        })
      })
    })

    describe('when the request fails', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [constants.API_NAME]: 'Test__c',
        },
      })

      let result: Promise<void>

      beforeEach(() => {
        mockDelete = jest.fn().mockImplementationOnce(async () => ([{
          success: false,
          fullName: 'Test__c',
          errors: [
            { message: 'Failed to remove Test__c' },
          ],
        }]))

        connection.metadata.delete = mockDelete

        result = adapter.remove(element)
      })

      it(
        'should reject the promise',
        () => expect(result).rejects.toEqual(new Error('Failed to remove Test__c'))
      )
    })

    describe('for a workflow instance element', () => {
      const workflowInstance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: WORKFLOW_TYPE_ID,
          annotations: {
            [constants.METADATA_TYPE]: constants.WORKFLOW_METADATA_TYPE,
          },
        }), {}
      )

      it('should not remove the instance in the main flow', async () => {
        await adapter.remove(workflowInstance)
        expect(mockDelete.mock.calls.length).toBe(0)
      })
    })
  })

  describe('Update operation', () => {
    describe('for an instance element', () => {
      const oldElement = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            [constants.INSTANCE_FULL_NAME_FIELD]:
              new Field(mockElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
          },
          annotationTypes: {},
          annotations: {
            [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
          },
        }),
        { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName },
      )

      const newElement = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            [constants.INSTANCE_FULL_NAME_FIELD]:
              new Field(mockElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
          },
          annotationTypes: {},
          annotations: {
            [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
          },
        }),
        { [constants.INSTANCE_FULL_NAME_FIELD]: 'wrong' },
      )

      describe('when the request fails because fullNames are not the same', () => {
        let result: Promise<Element>

        beforeEach(() => {
          result = adapter.update(oldElement, newElement, [])
          result.catch(_err => undefined) // prevent Unhandled promise rejection message
        })

        it(
          'should reject the promise',
          () => expect(result).rejects.toThrow()
        )

        it('should not call the connection', () => {
          expect(mockUpdate.mock.calls.length).toBe(0)
        })
      })
    })

    describe('for a type element', () => {
      const oldElement = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test2'),
        fields: {
          description: new Field(
            mockElemID,
            'description',
            stringType,
          ),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          label: 'test label',
          [constants.API_NAME]: 'Test2__c',
        },
      })

      const newElement = new ObjectType({
        elemID: mockElemID,
        fields: {
          address: new Field(
            mockElemID,
            'address',
            stringType,
          ),
        },
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          label: 'test2 label',
        },
      })

      describe('when the request fails because fullNames are not the same', () => {
        let result: Promise<Element>

        beforeEach(() => {
          result = adapter.update(oldElement, newElement, [])
          result.catch(_err => undefined) // prevent Unhandled promise rejection message
        })

        it(
          'should reject the promise',
          () => expect(result).rejects.toThrow()
        )

        it('should not call the connection', () => {
          expect(mockUpdate.mock.calls.length).toBe(0)
        })
      })
    })

    describe('when the request succeeds', () => {
      let result: Element

      describe('for an instance element', () => {
        const oldElement = new InstanceElement(
          mockInstanceName,
          new ObjectType({
            elemID: mockElemID,
            fields: {
              [constants.INSTANCE_FULL_NAME_FIELD]:
                new Field(mockElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
            },
            annotationTypes: {},
            annotations: {
              [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
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
                allowCreate: false,
                allowDelete: false,
                allowEdit: false,
                allowRead: false,
                modifyAllRecords: false,
                viewAllRecords: false,
                object: 'Lead',
              },
            ],
            description: 'old unit test instance profile',
            [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName,
          },
        )

        const newElement = new InstanceElement(
          mockInstanceName,
          new ObjectType({
            elemID: mockElemID,
            fields: {
              [constants.INSTANCE_FULL_NAME_FIELD]:
                new Field(mockElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
            },
            annotationTypes: {},
            annotations: {
              [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
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
            objectermissions: [
              {
                allowCreate: true,
                allowDelete: true,
                allowEdit: true,
                allowRead: true,
                modifyAllRecords: true,
                viewAllRecords: true,
                object: 'Lead',
              },
              {
                allowCreate: true,
                allowDelete: true,
                allowEdit: true,
                allowRead: true,
                modifyAllRecords: true,
                viewAllRecords: true,
                object: 'Account',
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
            [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName,
          },
        )

        beforeEach(async () => {
          result = await adapter.update(oldElement, newElement, [])
        })

        it('should return an InstanceElement', () => {
          expect(result).toBeInstanceOf(InstanceElement)
        })

        it('should call the connection methods correctly', () => {
          expect(mockUpdate.mock.calls.length).toBe(1)
          expect(mockUpdate.mock.calls[0][0]).toEqual(constants.PROFILE_METADATA_TYPE)
          const obj = mockUpdate.mock.calls[0][1][0]
          expect(obj.fullName).toEqual(mockInstanceName)
          expect(obj.description).toEqual(newElement.value.description)
          expect(obj.userPermissions).toEqual(newElement.value.userPermissions)
          expect(obj.fieldPermissions).toEqual(newElement.value.fieldPermissions)
          expect(obj.objectPermissions).toEqual(newElement.value.objectPermissions)
          expect(obj.applicationVisibilities).toEqual(newElement.value.applicationVisibilities)
          expect(obj.tabVisibilities).toEqual(newElement.value.tabVisibilities)
        })
      })

      describe('for a type element', () => {
        describe('when the change requires removing the old type', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              description: new Field(
                mockElemID,
                'description',
                stringType,
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
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
            annotations: {
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement, [
              { action: 'modify', data: { before: oldElement, after: newElement } },
              { action: 'remove', data: { before: oldElement.fields.description } },
              { action: 'add', data: { after: newElement.fields.address } },
            ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should call the connection methods correctly', () => {
            expect(mockUpsert.mock.calls.length).toBe(1)
            expect(mockDelete.mock.calls.length).toBe(1)
            expect(mockUpdate.mock.calls.length).toBe(1)
          })

          it('should not add annotations to the object type', () => {
            expect(result.annotations).toEqual(newElement.annotations)
          })
        })

        describe('when the new object\'s change is only new fields', () => {
          const oldElement = new ObjectType({
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
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
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
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement, [
              { action: 'add', data: { after: newElement.fields.description } },
              { action: 'add', data: { after: newElement.fields.apple } },
            ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should call the connection methods correctly', () => {
            expect(mockUpsert.mock.calls.length).toBe(1)
            expect(mockDelete.mock.calls.length).toBe(0)
            expect(mockUpdate.mock.calls.length).toBe(0)
            // Verify the custom fields creation
            const fields = mockUpsert.mock.calls[0][1]
            expect(fields.length).toBe(2)
            expect(fields[0].fullName).toBe('Test__c.description__c')
            expect(fields[0].type).toBe('Text')
            expect(fields[0].length).toBe(80)
            expect(fields[0].required).toBe(false)
            expect(fields[1].fullName).toBe('Test__c.apple__c')
          })
        })

        describe('when the only change in the new object is that some fields no longer appear', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              address: new Field(
                mockElemID,
                'address',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Address__c',
                },
              ),
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              ),
              description: new Field(
                mockElemID,
                'description',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Description__c',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              description: new Field(
                mockElemID,
                'description',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Description__c',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement, [
              { action: 'remove', data: { before: oldElement.fields.address } },
              { action: 'remove', data: { before: oldElement.fields.banana } },
            ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should only delete fields', () => {
            expect(mockUpsert.mock.calls.length).toBe(0)
            expect(mockUpdate.mock.calls.length).toBe(0)
            expect(mockDelete.mock.calls.length).toBe(1)

            const fields = mockDelete.mock.calls[0][1]
            expect(fields.length).toBe(2)
            expect(fields[0]).toBe('Test__c.Address__c')
            expect(fields[1]).toBe('Test__c.Banana__c')
          })
        })

        describe('when there are new fields and deleted fields', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              address: new Field(
                mockElemID,
                'address',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Address__c',
                },
              ),
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                }
              ),
              description: new Field(
                mockElemID,
                'description',
                stringType,
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement, [
              { action: 'remove', data: { before: oldElement.fields.address } },
              { action: 'add', data: { after: newElement.fields.description } },
            ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should only call delete and upsert', () => {
            expect(mockUpsert).toHaveBeenCalled()
            expect(mockDelete).toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
          })

          it('should call the connection.upsert method correctly', () => {
            // Verify the custom fields creation
            const addedFields = mockUpsert.mock.calls[0][1]
            expect(addedFields.length).toBe(1)
            const field = addedFields[0]
            expect(field.fullName).toBe('Test__c.description__c')
            expect(field.type).toBe('Text')
            expect(field.length).toBe(80)
            expect(field.required).toBe(false)
          })

          it('should call the connection.delete method correctly', () => {
            // Verify the custom fields deletion
            const deletedFields = mockDelete.mock.calls[0][1]
            expect(deletedFields.length).toBe(1)
            expect(deletedFields[0]).toBe('Test__c.Address__c')
          })
        })

        describe('when the annotation values are changed', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              description: new Field(
                mockElemID,
                'description',
                stringType,
              ),
            },
            annotations: {
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              description: new Field(
                mockElemID,
                'description',
                stringType,
              ),
            },
            annotations: {
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement, [
              { action: 'modify', data: { before: oldElement, after: newElement } },
            ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should only call update', () => {
            expect(mockUpsert.mock.calls.length).toBe(0)
            expect(mockDelete.mock.calls.length).toBe(0)
            expect(mockUpdate.mock.calls.length).toBe(1)
          })

          it('should call the update method correctly', () => {
            const objectSentForUpdate = mockUpdate.mock.calls[0][1][0]
            expect(objectSentForUpdate.fullName).toBe('Test__c')
            expect(objectSentForUpdate.label).toBe('test2 label')
          })
        })

        describe('when the annotation values of the remaining fields of the object have changed', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              address: new Field(
                mockElemID,
                'address',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Address__c',
                  [constants.LABEL]: 'Address',
                },
              ),
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                  [constants.LABEL]: 'Banana',
                },
              ),
              cat: new Field(
                mockElemID,
                'cat',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Cat__c',
                  [constants.LABEL]: 'Cat',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                  [constants.LABEL]: 'Banana Split',
                },
              ),
              cat: new Field(
                mockElemID,
                'cat',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Cat__c',
                  [constants.LABEL]: 'Cat',
                },
              ),
              description: new Field(
                mockElemID,
                'description',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Description__c',
                  [constants.LABEL]: 'Description',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement,
              [
                { action: 'remove', data: { before: oldElement.fields.address } },
                { action: 'modify',
                  data: {
                    before: oldElement.fields.banana,
                    after: newElement.fields.banana,
                  } },
                { action: 'add', data: { after: newElement.fields.description } },
              ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should call delete, upsert and update', () => {
            expect(mockUpsert).toHaveBeenCalled()
            expect(mockDelete).toHaveBeenCalled()
            expect(mockUpdate).toHaveBeenCalled()
          })

          it('should call the connection methods correctly', () => {
            const addedFields = mockUpsert.mock.calls[0][1]
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
        })

        describe('when the remaining fields did not change', () => {
          const oldElement = new ObjectType({
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
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              address: new Field(
                mockElemID,
                'address',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Address__c',
                },
              ),
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement, [])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should not call delete, upsert or update', () => {
            expect(mockUpsert).not.toHaveBeenCalled()
            expect(mockDelete).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
          })
        })

        describe('when object annotations change and fields that remain change', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              banana: new Field(
                mockElemID,
                'banana',
                stringType,
                {
                  [constants.LABEL]: 'Banana Split',
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              ),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.update(oldElement, newElement,
              [
                { action: 'modify', data: { before: oldElement, after: newElement } },
                { action: 'modify',
                  data: { before: oldElement.fields.banana,
                    after: newElement.fields.banana } },
              ])
          })

          it('should return an instance of ObjectType', () => {
            expect(result).toBeInstanceOf(ObjectType)
          })

          it('should call update twice', () => {
            expect(mockUpsert.mock.calls.length).toBe(0)
            expect(mockDelete.mock.calls.length).toBe(0)
            expect(mockUpdate.mock.calls.length).toBe(2)
          })

          it('should call update correctly the first time for the custom field update', () => {
            // Verify the custom field update
            const updatedFields = mockUpdate.mock.calls[0][1]
            expect(updatedFields.length).toBe(1)
            const field = updatedFields[0]
            expect(field.fullName).toBe('Test__c.Banana__c')
            expect(field.type).toBe('Text')
            expect(field.label).toBe('Banana Split')
            expect(field.length).toBe(80)
            expect(field.required).toBe(false)
          })

          it('should call update correctly the second time for the object update', () => {
            const updatedObject = mockUpdate.mock.calls[1][1][0]
            expect(updatedObject.fullName).toBe('Test__c')
            expect(updatedObject.label).toBe('test2 label')
            expect(updatedObject.fields).toBeUndefined()
          })
        })
      })
    })

    describe('update with deploy', () => {
      const deployTypeId = ASSIGNMENT_RULES_TYPE_ID
      const deployType = new ObjectType({
        elemID: deployTypeId,
        annotations: {
          [constants.METADATA_TYPE]: 'AssignmentRules',
        },
        fields: {
          dummy: new Field(deployTypeId, 'dummy', BuiltinTypes.STRING),
        },
      })
      const origBefore = new InstanceElement(
        'deploy_inst',
        deployType,
        { dummy: 'before' },
      )

      let before: InstanceElement
      let after: InstanceElement
      beforeEach(() => {
        before = _.cloneDeep(origBefore)
        after = new InstanceElement(
          before.elemID.name,
          before.type,
          _.cloneDeep(before.value),
        )
        after.value.dummy = 'after'
      })

      describe('when the deploy call succeeds', () => {
        it('should update with deploy for specific types', async () => {
          await adapter.update(before, after, [])
          expect(mockDeploy).toHaveBeenCalled()
          expect(mockUpdate).not.toHaveBeenCalled()
        })
      })

      describe('when the deploy call should not be triggered', () => {
        it('should not update with deploy for unsupported types even if listed', async () => {
          before.type.annotations[constants.METADATA_TYPE] = 'UnsupportedType'
          after.type.annotations[constants.METADATA_TYPE] = 'UnsupportedType'
          await adapter.update(before, after, [])
          expect(mockDeploy).not.toHaveBeenCalled()
          expect(mockUpdate).not.toHaveBeenCalled()
        })
        it('should not update with deploy not listed types', async () => {
          before.type.annotations[constants.METADATA_TYPE] = 'NotListedType'
          after.type.annotations[constants.METADATA_TYPE] = 'NotListedType'
          await adapter.update(before, after, [])
          expect(mockDeploy).not.toHaveBeenCalled()
          expect(mockUpdate).toHaveBeenCalled()
        })
      })

      describe('when the deploy call fails', () => {
        const getDeployDetails = (type: string, name: string, problem: string): DeployDetails => ({
          componentFailures: [{
            changed: false,
            columnNumber: 0,
            componentType: type,
            created: false,
            createdDate: '',
            deleted: false,
            fileName: '',
            fullName: name,
            id: '',
            lineNumber: 0,
            problem,
            problemType: 'Error',
            success: false,
          }],
        })

        beforeEach(() => {
          connection.metadata.deploy = jest.fn().mockImplementationOnce(
            () => ({
              complete: () => getDeployResult(false, [
                getDeployDetails('Component', 'InstName', 'my error'),
                getDeployDetails('Component', 'OtherInst', 'some error'),
              ]),
            })
          )
        })

        it('should reject the promise', async () => {
          await expect(adapter.update(before, after, [])).rejects.toThrow(
            /Component.*InstName.*my error.*Component.*OtherInst.*some error/s
          )
        })
      })
    })

    describe('for a workflow instance element', () => {
      const beforeWorkflowInstance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: WORKFLOW_TYPE_ID,
          annotations: {
            [constants.METADATA_TYPE]: constants.WORKFLOW_METADATA_TYPE,
          },
        }), {}
      )

      it('should not update the instance in the main flow', async () => {
        await adapter.update(beforeWorkflowInstance, beforeWorkflowInstance.clone(), [])
        expect(mockUpdate.mock.calls.length).toBe(0)
      })
    })

    it('should update certain metadata types using upsert', async () => {
      const beforeFlowInstance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, 'Flow'),
          annotations: {
            [constants.METADATA_TYPE]: 'Flow',
          },
        }), {}
      )
      await adapter.update(beforeFlowInstance, beforeFlowInstance.clone(), [])
      expect(mockUpdate.mock.calls.length).toBe(0)
      expect(mockUpsert.mock.calls.length).toBe(1)
    })
  })
})
