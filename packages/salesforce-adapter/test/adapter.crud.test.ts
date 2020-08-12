/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  ObjectType, ElemID, InstanceElement, BuiltinTypes, CORE_ANNOTATIONS, ReferenceExpression,
  createRestriction, DeployResult, getChangeElement, isAdditionChange, isInstanceElement,
} from '@salto-io/adapter-api'
import {
  MetadataInfo, SaveResult, DeployResult as JSForceDeployResult, DeployDetails,
  BulkLoadOperation, BulkOptions, Record as SfRecord, Batch,
} from 'jsforce'
import { EventEmitter } from 'events'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { Types } from '../src/transformers/transformer'
import Connection from '../src/client/jsforce'
import mockAdapter from './adapter'
import { createValueSetEntry } from './utils'
import { WORKFLOW_TYPE_ID } from '../src/filters/workflow'
import { createElement, removeElement } from '../e2e_test/utils'

const { makeArray } = collections.array

describe('SalesforceAdapter CRUD', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  const stringType = Types.primitiveDataTypes.Text
  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const mockInstanceName = 'Instance'
  const anotherMockInstanceName = 'AnotherInstance'

  const getDeployResult = (
    success: boolean, details?: DeployDetails[]
  ): Promise<JSForceDeployResult> =>
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

  const getBulkLoadMock = (mode: string): jest.Mock<Batch> =>
    (jest.fn().mockImplementation(
      (_type: string, _operation: BulkLoadOperation, _opt?: BulkOptions, input?: SfRecord[]) => {
        const isError = (index: number): boolean => {
          if (mode === 'fail') {
            return true
          }
          // For partial mode return error every 2nd index
          return mode === 'partial' && (index % 2) === 0
        }

        const loadEmitter = new EventEmitter()
        loadEmitter.on('newListener', (_event, _listener) => {
          // This is a workaround to call emit('close')
          // that is really called as a side effect to load() inside
          // jsforce *after* our code listens on.('close')
          setTimeout(() => loadEmitter.emit('close'), 0)
        })
        return {
          then: () => (Promise.resolve(input?.map((res, index) => ({
            id: res.Id || 'newId',
            success: !isError(index),
            errors: isError(index) ? ['Error message'] : [],
          })))),
          job: loadEmitter,
        }
      }
    ))

  const deployTypeNames = [
    'AssignmentRules',
    'UnsupportedType',
  ]

  let mockUpsert: jest.Mock
  let mockDelete: jest.Mock
  let mockUpdate: jest.Mock
  let mockDeploy: jest.Mock
  let mockBulkLoad: jest.Mock

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        filterCreators: [],
        metadataToDeploy: deployTypeNames,
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
    mockBulkLoad = getBulkLoadMock('success')
    connection.bulk.load = mockBulkLoad
  })

  describe('Add operation', () => {
    describe('for an instance element', () => {
      const instance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            username: { type: BuiltinTypes.STRING },
            password: { type: BuiltinTypes.STRING },
            token: { type: BuiltinTypes.STRING },
            sandbox: { type: BuiltinTypes.BOOLEAN },
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
          result = await createElement(adapter, instance)
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
        let result: DeployResult

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

          const newInst = new InstanceElement(
            mockInstanceName,
            new ObjectType({
              elemID: mockElemID,
              fields: {},
              annotationTypes: {},
              annotations: {},
            }),
            {},
          )

          result = await adapter.deploy({
            groupID: newInst.elemID.getFullName(),
            changes: [{ action: 'add', data: { after: newInst } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Failed to add Test__c\nAdditional message'))
        })
      })
    })

    describe('for instances of custom objects', () => {
      let result: DeployResult
      const customObject = new ObjectType({
        elemID: mockElemID,
        fields: {
          Id: { type: BuiltinTypes.STRING },
          Name: {
            type: BuiltinTypes.STRING,
            annotations: {
              [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotCreatable: {
            type: BuiltinTypes.STRING,
            annotations: {
              [constants.FIELD_ANNOTATIONS.CREATABLE]: false,
            },
          },
          AnotherField: {
            type: BuiltinTypes.STRING,
            annotations: {
              [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
        },
        annotationTypes: {},
        annotations: {
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.API_NAME]: 'Type',
        },
      })
      const instance = new InstanceElement(
        mockInstanceName,
        customObject,
        {
          Name: 'instanceName',
          NotCreatable: 'DontSendMeOnCreate',
        }
      )
      const anotherInstance = new InstanceElement(
        anotherMockInstanceName,
        customObject,
        {
          Name: 'anotherInstanceName',
          AnotherField: new ReferenceExpression(mockElemID, 'Type'),
        }
      )

      describe('when request succeeds', () => {
        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: 'add_Test_instances',
            changes: [
              { action: 'add', data: { after: instance } },
              { action: 'add', data: { after: anotherInstance } },
            ],
          })
        })

        it('should call load operation with the right records', () => {
          expect(mockBulkLoad.mock.calls.length).toBe(1)
          expect(mockBulkLoad.mock.calls[0].length).toBe(4)
          expect(mockBulkLoad.mock.calls[0][0]).toBe('Type')
          expect(mockBulkLoad.mock.calls[0][1]).toBe('insert')

          // Records
          expect(mockBulkLoad.mock.calls[0][3].length).toBe(2)
          expect(mockBulkLoad.mock.calls[0][3][0].Name).toBeDefined()
          expect(mockBulkLoad.mock.calls[0][3][0].Name).toEqual('instanceName')
          expect(mockBulkLoad.mock.calls[0][3][0].NotCreatable).toBeUndefined()
          expect(mockBulkLoad.mock.calls[0][3][1].Name).toBeDefined()
          expect(mockBulkLoad.mock.calls[0][3][1].Name).toEqual('anotherInstanceName')
          expect(mockBulkLoad.mock.calls[0][3][1].AnotherField).toBeDefined()
          expect(mockBulkLoad.mock.calls[0][3][1].AnotherField).toEqual('Type')
        })

        it('Should have result with 2 applied changes, add 2 instances with new Id', async () => {
          expect(result.errors).toHaveLength(0)
          expect(result.appliedChanges).toHaveLength(2)

          // First instance
          expect(getChangeElement(result.appliedChanges[0])).toBeInstanceOf(InstanceElement)
          const firstChangeElement = getChangeElement(result.appliedChanges[0]) as InstanceElement
          expect(firstChangeElement.elemID).toEqual(instance.elemID)
          expect(firstChangeElement.value.Name).toBeDefined()
          expect(firstChangeElement.value.Name).toBe('instanceName')
          // Should add result Id
          expect(firstChangeElement.value.Id).toBeDefined()
          expect(firstChangeElement.value.Id).toEqual('newId')

          // 2nd instance
          expect(getChangeElement(result.appliedChanges[1])).toBeInstanceOf(InstanceElement)
          const secondChangeElement = getChangeElement(result.appliedChanges[1]) as InstanceElement
          expect(secondChangeElement.elemID).toEqual(anotherInstance.elemID)
          expect(secondChangeElement.value.Name).toBeDefined()
          expect(secondChangeElement.value.Name).toBe('anotherInstanceName')
          // Should add result Id
          expect(secondChangeElement.value.Id).toBeDefined()
          expect(secondChangeElement.value.Id).toEqual('newId')

          // Reference should stay a referece
          expect(secondChangeElement.value.AnotherField)
            .toEqual(new ReferenceExpression(mockElemID, 'Type'))
        })
      })

      describe('When load partially fails', () => {
        beforeEach(async () => {
          connection.bulk.load = getBulkLoadMock('partial')
          result = await adapter.deploy({
            groupID: 'add_Test_instances',
            changes: [
              { action: 'add', data: { after: instance } },
              { action: 'add', data: { after: anotherInstance } },
            ],
          })
        })

        it('should have one error', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Error message'))
        })

        it('should have one applied add change', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(isAdditionChange(result.appliedChanges[0])).toBeTruthy()
          const changeElement = getChangeElement(result.appliedChanges[0])
          expect(changeElement).toBeDefined()
          expect(isInstanceElement(changeElement)).toBeTruthy()
          expect(changeElement.elemID).toEqual(anotherInstance.elemID)
        })
      })

      describe('When load fails', () => {
        describe('remove', () => {
          beforeEach(async () => {
            connection.bulk.load = getBulkLoadMock('fail')
            result = await adapter.deploy({
              groupID: instance.elemID.getFullName(),
              changes: [{ action: 'remove', data: { before: instance } }],
            })
          })

          it('should return an error', () => {
            expect(result.errors).toHaveLength(1)
            expect(result.errors[0]).toEqual(new Error('Error message'))
            expect(result.appliedChanges).toHaveLength(0)
          })
        })

        describe('add', () => {
          beforeEach(async () => {
            connection.bulk.load = getBulkLoadMock('fail')
            result = await adapter.deploy({
              groupID: instance.elemID.getFullName(),
              changes: [{ action: 'add', data: { after: instance } }],
            })
          })

          it('should return an error', () => {
            expect(result.errors).toHaveLength(1)
            expect(result.errors[0]).toEqual(new Error('Error message'))
            expect(result.appliedChanges).toHaveLength(0)
          })
        })

        describe('modify', () => {
          beforeEach(async () => {
            connection.bulk.load = getBulkLoadMock('fail')
            result = await adapter.deploy({
              groupID: instance.elemID.getFullName(),
              changes: [{ action: 'modify', data: { before: instance, after: instance } }],
            })
          })

          it('should return an error', () => {
            expect(result.errors).toHaveLength(1)
            expect(result.errors[0]).toEqual(new Error('Error message'))
            expect(result.appliedChanges).toHaveLength(0)
          })
        })
      })

      describe('when group has more than one action', () => {
        it('should return with an error', async () => {
          result = await adapter.deploy({
            groupID: 'multipleActionsGroup',
            changes: [
              { action: 'add', data: { after: instance } },
              { action: 'remove', data: { before: anotherInstance } },
            ],
          })
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Custom Object Instances change group must have one action'))
        })
      })

      describe('when group has more than one type', () => {
        const instanceOfAnotherType = new InstanceElement(
          'diffTypeInstance',
          new ObjectType({
            elemID: new ElemID('anotherType'),
            annotations: {
              [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
              [constants.API_NAME]: 'anotherType',
            },
          })
        )

        it('should fail on add', async () => {
          result = await adapter.deploy({
            groupID: 'badGroup',
            changes: [
              { action: 'add', data: { after: instance } },
              { action: 'add', data: { after: instanceOfAnotherType } },
            ],
          })
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Custom Object Instances change group should have a single type but got: Type,anotherType'))
        })

        it('should fail on remove', async () => {
          result = await adapter.deploy({
            groupID: 'badGroup',
            changes: [
              { action: 'remove', data: { before: instance } },
              { action: 'remove', data: { before: instanceOfAnotherType } },
            ],
          })
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Custom Object Instances change group should have a single type but got: Type,anotherType'))
        })

        it('should fail on modify', async () => {
          result = await adapter.deploy({
            groupID: 'badGroup',
            changes: [
              { action: 'modify', data: { before: instance, after: instance } },
              { action: 'modify', data: { before: instanceOfAnotherType, after: instanceOfAnotherType } },
            ],
          })
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Custom Object Instances change group should have a single type but got: Type,anotherType'))
        })
      })
    })

    describe('for a type element', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          description: {
            type: stringType,
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.LABEL]: 'test label',
            },
          },
          formula: {
            type: stringType,
            annotations: {
              [constants.LABEL]: 'formula field',
              [constants.FORMULA]: 'my formula',
            },
          },
        },
      })

      let result: ObjectType

      beforeEach(async () => {
        result = await createElement(adapter, element)
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
          state: {
            type: Types.primitiveDataTypes.Picklist,
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('NEW', true),
                createValueSetEntry('OLD'),
              ],
            },
          },
        },
      })

      let result: ObjectType

      beforeEach(async () => {
        result = await createElement(adapter, element)
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
        expect(result).toMatchObject({
          ...element,
          fields: _.mapValues(element.fields, f => _.omit(f, 'parent')),
        })
        expect(result.annotations).toBeDefined()
      })
    })

    describe('for a new salesforce type with different field types', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          currency: {
            type: Types.primitiveDataTypes.Currency,
            annotations: {
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
            },
          },
          auto: {
            type: Types.primitiveDataTypes.AutoNumber,
            annotations: {
              [constants.LABEL]: 'Autonumber description label',
              [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
            },
          },
          date: {
            type: Types.primitiveDataTypes.Date,
            annotations: {
              [constants.LABEL]: 'Date description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Today() + 7',
            },
          },
          time: {
            type: Types.primitiveDataTypes.Time,
            annotations: {
              [constants.LABEL]: 'Time description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'TIMENOW() + 5',
            },
          },
          datetime: {
            type: Types.primitiveDataTypes.DateTime,
            annotations: {
              [constants.LABEL]: 'DateTime description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Now() + 7',
            },
          },
          email: {
            type: Types.primitiveDataTypes.Email,
            annotations: {
              [constants.LABEL]: 'Email description label',
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
            },
          },
          location: {
            type: Types.compoundDataTypes.Location,
            annotations: {
              [constants.LABEL]: 'Location description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 2,
              [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
            },
          },
          multipicklist: {
            type: Types.primitiveDataTypes.MultiselectPicklist,
            annotations: {
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
          },
          percent: {
            type: Types.primitiveDataTypes.Percent,
            annotations: {
              [constants.LABEL]: 'Percent description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
            },
          },
          phone: {
            type: Types.primitiveDataTypes.Phone,
            annotations: {
              [constants.LABEL]: 'Phone description label',
            },
          },
          longtextarea: {
            type: Types.primitiveDataTypes.LongTextArea,
            annotations: {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
            },
          },
          richtextarea: {
            type: Types.primitiveDataTypes.Html,
            annotations: {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
            },
          },
          textarea: {
            type: Types.primitiveDataTypes.TextArea,
            annotations: {
              [constants.LABEL]: 'TextArea description label',
            },
          },
          encryptedtext: {
            type: Types.primitiveDataTypes.EncryptedText,
            annotations: {
              [constants.LABEL]: 'EncryptedText description label',
              [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'creditCard',
              [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
              [constants.FIELD_ANNOTATIONS.LENGTH]: 35,
            },
          },
          url: {
            type: Types.primitiveDataTypes.Url,
            annotations: {
              [constants.LABEL]: 'Url description label',
            },
          },
          picklist: {
            type: Types.primitiveDataTypes.Picklist,
            annotations: {
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
          },
          text: {
            type: Types.primitiveDataTypes.Text,
            annotations: {
              [constants.LABEL]: 'Text description label',
              [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
                values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
              }),
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
              [constants.FIELD_ANNOTATIONS.LENGTH]: 90,
            },
          },
          number: {
            type: Types.primitiveDataTypes.Number,
            annotations: {
              [constants.LABEL]: 'Number description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 12,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
            },
          },
          checkbox: {
            type: Types.primitiveDataTypes.Checkbox,
            annotations: {
              [constants.LABEL]: 'Checkbox description label',
              [constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]: true,
            },
          },
        },
      })

      beforeEach(async () => {
        await createElement(adapter, element)
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
        await createElement(adapter, workflowInstance)
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
              username: { type: BuiltinTypes.STRING },
              password: { type: BuiltinTypes.STRING },
              token: { type: BuiltinTypes.STRING },
              sandbox: { type: BuiltinTypes.BOOLEAN },
              [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
            },
            annotationTypes: {},
            annotations: { [constants.METADATA_TYPE]: 'Flow' },
          }),
          { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName },
        )

        beforeEach(async () => {
          await removeElement(adapter, element)
        })

        it('should call the connection methods correctly', () => {
          expect(mockDelete.mock.calls.length).toBe(1)
          expect(mockDelete.mock.calls[0][0]).toBe('Flow')
          expect(mockDelete.mock.calls[0][1][0]).toBe('Instance')
        })
      })

      describe('for instances of custom objects', () => {
        const instance = new InstanceElement(
          mockInstanceName,
          new ObjectType({
            elemID: mockElemID,
            fields: {
              Id: { type: BuiltinTypes.STRING },
              Name: { type: BuiltinTypes.STRING },
            },
            annotationTypes: {},
            annotations: {
              [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
              [constants.API_NAME]: 'Test',
            },
          }),
          {
            Id: 'DeleteId',
            Name: 'instanceName',
          }
        )

        beforeEach(async () => {
          await removeElement(adapter, instance)
        })

        it('should call the connection methods correctly', async () => {
          expect(mockBulkLoad.mock.calls.length).toBe(1)
          expect(mockBulkLoad.mock.calls[0][0]).toBe('Test')
          expect(mockBulkLoad.mock.calls[0][1]).toBe('delete')

          // Record
          expect(mockBulkLoad.mock.calls[0][3].length).toBe(1)
          expect(mockBulkLoad.mock.calls[0][3][0].Id).toBeDefined()
          expect(mockBulkLoad.mock.calls[0][3][0].Id).toBe('DeleteId')
          expect(mockBulkLoad.mock.calls[0][3][0].Name).toBeUndefined()
        })
      })

      describe('for a type element', () => {
        const element = new ObjectType({
          elemID: mockElemID,
          fields: {
            description: { type: stringType },
          },
          annotations: {
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          await removeElement(adapter, element)
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

      let result: DeployResult
      // let result: Promise<void>

      beforeEach(async () => {
        mockDelete = jest.fn().mockImplementationOnce(async () => ([{
          success: false,
          fullName: 'Test__c',
          errors: [
            { message: 'Failed to remove Test__c' },
          ],
        }]))

        connection.metadata.delete = mockDelete

        result = await adapter.deploy({
          groupID: element.elemID.getFullName(),
          changes: [{ action: 'remove', data: { before: element } }],
        })
      })

      it('should return an error', () => {
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toEqual(new Error('Failed to remove Test__c'))
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

      it('should not remove the instance in the main flow', async () => {
        await removeElement(adapter, workflowInstance)
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
            [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
          },
          annotationTypes: {},
          annotations: {
            [constants.METADATA_TYPE]: 'AssignmentRules',
          },
        }),
        { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName },
      )

      describe('when the request fails because fullNames are not the same', () => {
        let result: DeployResult

        beforeEach(async () => {
          const newElement = oldElement.clone()
          newElement.value[constants.INSTANCE_FULL_NAME_FIELD] = 'wrong'
          result = await adapter.deploy({
            groupID: newElement.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: oldElement, after: newElement } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })

        it('should return empty applied changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should not call the connection', () => {
          expect(mockUpdate.mock.calls.length).toBe(0)
        })
      })

      describe('delete metadata objects inside of instances upon update', () => {
        describe('objects names are nested', () => {
          const assignmentRuleFieldName = 'assignmentRule'
          const mockAssignmentRulesObjectType = new ObjectType({
            elemID: mockElemID,
            fields: {
              [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
              [assignmentRuleFieldName]: {
                type: new ObjectType({
                  elemID: mockElemID,
                  fields: {
                    [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
                  },
                  annotations: {
                    [constants.METADATA_TYPE]: 'AssignmentRule',
                  },
                }),
              },
            },
            annotationTypes: {},
            annotations: {
              [constants.METADATA_TYPE]: 'AssignmentRules',
            },
          })
          const oldAssignmentRules = new InstanceElement(
            mockInstanceName,
            mockAssignmentRulesObjectType,
            { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName,
              [assignmentRuleFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val2' },
              ] },
          )
          const newAssignmentRules = new InstanceElement(
            mockInstanceName,
            mockAssignmentRulesObjectType,
            { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName,
              [assignmentRuleFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
              ] },
          )

          beforeEach(async () => {
            await adapter.deploy({
              groupID: oldAssignmentRules.elemID.getFullName(),
              changes: [{
                action: 'modify',
                data: { before: oldAssignmentRules, after: newAssignmentRules },
              }],
            })
          })

          it('should call delete on remove metadata objects with field names', () => {
            expect(mockDelete.mock.calls.length).toBe(1)
            expect(mockDelete.mock.calls[0][1][0]).toEqual('Instance.Val2')
            expect(mockDelete.mock.calls[0][0]).toEqual('AssignmentRule')
          })
        })

        describe('objects names are absolute', () => {
          const customLabelsFieldName = 'labels'
          const mockCustomLabelsObjectType = new ObjectType({
            elemID: mockElemID,
            fields: {
              [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
              [customLabelsFieldName]: {
                type: new ObjectType({
                  elemID: mockElemID,
                  fields: {
                    [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
                  },
                  annotations: {
                    [constants.METADATA_TYPE]: 'CustomLabel',
                  },
                }),
              },
            },
            annotationTypes: {},
            annotations: {
              [constants.METADATA_TYPE]: 'CustomLabels',
            },
          })
          const oldCustomLabels = new InstanceElement(
            mockInstanceName,
            mockCustomLabelsObjectType,
            { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName,
              [customLabelsFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val2' },
              ] },
          )
          const newCustomLabels = new InstanceElement(
            mockInstanceName,
            mockCustomLabelsObjectType,
            { [constants.INSTANCE_FULL_NAME_FIELD]: mockInstanceName,
              [customLabelsFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
              ] },
          )

          beforeEach(async () => {
            await adapter.deploy({
              groupID: oldCustomLabels.elemID.getFullName(),
              changes: [{
                action: 'modify',
                data: { before: oldCustomLabels, after: newCustomLabels },
              }],
            })
          })

          it('should call delete on remove metadata objects with object names', () => {
            expect(mockDelete.mock.calls.length).toBe(1)
            expect(mockDelete.mock.calls[0][1][0]).toEqual('Val2')
            expect(mockDelete.mock.calls[0][0]).toEqual('CustomLabel')
          })
        })
      })
    })

    describe('for instances of custom objects', () => {
      const updateObjectType = new ObjectType({
        elemID: mockElemID,
        fields: {
          Id: { type: BuiltinTypes.STRING },
          Name: {
            type: BuiltinTypes.STRING,
            annotations: {
              [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
            },
          },
          NotUpdateable: {
            type: BuiltinTypes.STRING,
            annotations: {
              [constants.FIELD_ANNOTATIONS.UPDATEABLE]: false,
            },
          },
        },
        annotationTypes: {},
        annotations: {
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.API_NAME]: 'Test',
        },
      })
      const oldInstance = new InstanceElement(
        mockInstanceName,
        updateObjectType,
        {
          Id: 'InstanceId',
          Name: 'instanceName',
          NotUpdateable: 'DontSendMeOnUpdate',
        }
      )
      const newInstance = new InstanceElement(
        mockInstanceName,
        updateObjectType,
        {
          Id: 'InstanceId',
          Name: 'newInstanceName',
          NotUpdateable: 'NewDontSendMeOnUpdate',
        }
      )

      describe('when succeeds', () => {
        let result: DeployResult
        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldInstance.elemID.getFullName(),
            changes: [{
              action: 'modify',
              data: { before: oldInstance, after: newInstance },
            }],
          })
        })

        it('should call load operation with the right records', () => {
          expect(mockBulkLoad.mock.calls.length).toBe(1)
          expect(mockBulkLoad.mock.calls[0].length).toBe(4)
          expect(mockBulkLoad.mock.calls[0][0]).toBe('Test')
          expect(mockBulkLoad.mock.calls[0][1]).toBe('update')

          // Record
          expect(mockBulkLoad.mock.calls[0][3].length).toBe(1)
          expect(mockBulkLoad.mock.calls[0][3][0].Name).toBeDefined()
          expect(mockBulkLoad.mock.calls[0][3][0].Name).toEqual(newInstance.value.Name)
          expect(mockBulkLoad.mock.calls[0][3][0].Id).toBeDefined()
          expect(mockBulkLoad.mock.calls[0][3][0].Id).toEqual(newInstance.value.Id)
          expect(mockBulkLoad.mock.calls[0][3][0].NotUpdateable).toBeUndefined()
        })

        it('should return an InstanceElement', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toBeInstanceOf(InstanceElement)
        })

        it('Should add new instance with Id', async () => {
          const resultInstance = getChangeElement(result.appliedChanges[0]) as InstanceElement
          expect(resultInstance.elemID).toEqual(oldInstance.elemID)
          expect(resultInstance.value.Name).toBeDefined()
          expect(resultInstance.value.Name).toBe(newInstance.value.Name)
          expect(resultInstance.value.Id).toBeDefined()
          expect(resultInstance.value.Id).toEqual(newInstance.value.Id)
          expect(resultInstance.value.NotUpdateable).toEqual(newInstance.value.NotUpdateable)
        })
      })

      describe('when the request fails because Ids are not the same', () => {
        let result: DeployResult

        beforeEach(async () => {
          const newInstanceDiffId = newInstance.clone()
          newInstanceDiffId.value.Id = 'wrong'
          result = await adapter.deploy({
            groupID: newInstanceDiffId.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: oldInstance, after: newInstanceDiffId } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })

        it('should return empty applied changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should not call the connection', () => {
          expect(mockUpdate.mock.calls.length).toBe(0)
        })
      })
    })

    describe('for a type element', () => {
      const oldElement = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [constants.API_NAME]: 'Test__c',
        },
      })

      describe('when the request fails because fullNames are not the same', () => {
        let result: DeployResult

        beforeEach(async () => {
          const newElement = oldElement.clone()
          newElement.annotations[constants.API_NAME] = 'Test2__c'
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: oldElement, after: newElement } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })

        it('should return empty applied changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should not call the connection', () => {
          expect(mockUpdate.mock.calls.length).toBe(0)
        })
      })
    })

    describe('when the request succeeds', () => {
      let result: DeployResult

      describe('for an instance element', () => {
        const mockProfileType = new ObjectType({
          elemID: mockElemID,
          fields: {
            [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
          },
          annotationTypes: {},
          annotations: {
            [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
          },
        })
        const oldElement = new InstanceElement(
          mockInstanceName,
          mockProfileType,
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
          mockProfileType,
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
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: oldElement, after: newElement } }],
          })
        })

        it('should return an InstanceElement', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toBeInstanceOf(InstanceElement)
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
              description: { type: stringType },
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
              address: {
                type: stringType,
                annotations: {
                  label: 'test2 label',
                  [constants.API_NAME]: 'Test__c.address__c',
                },
              },
            },
            annotations: {
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: oldElement, after: newElement } },
                { action: 'remove', data: { before: oldElement.fields.description } },
                { action: 'add', data: { after: newElement.fields.address } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
          })

          it('should call the connection methods correctly', () => {
            expect(mockUpsert.mock.calls.length).toBe(1)
            expect(mockDelete.mock.calls.length).toBe(1)
            expect(mockUpdate.mock.calls.length).toBe(1)
          })

          it('should not add annotations to the object type', () => {
            const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
            expect(updatedObj).toBeDefined()
            expect(updatedObj.annotations).toEqual(newElement.annotations)
          })
        })

        describe('when the new object\'s change is only new fields', () => {
          const oldElement = new ObjectType({
            elemID: mockElemID,
            fields: {
              address: { type: stringType },
              banana: { type: stringType },
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
              ...oldElement.fields,
              description: { type: stringType },
              apple: { type: stringType },
            },
            annotations: oldElement.annotations,
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'add', data: { after: newElement.fields.description } },
                { action: 'add', data: { after: newElement.fields.apple } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
            expect(Object.keys(updatedObj.fields)).toEqual(Object.keys(newElement.fields))
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
              address: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Address__c',
                },
              },
              banana: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              },
              description: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Description__c',
                },
              },
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })


          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'remove', data: { before: oldElement.fields.address } },
                { action: 'remove', data: { before: oldElement.fields.banana } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
            expect(Object.keys(updatedObj.fields)).toEqual(
              Object.keys(_.omit(oldElement.fields, ['address', 'banana']))
            )
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
              address: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Address__c',
                },
              },
              banana: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              },
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
              ..._.pick(oldElement.fields, 'banana'),
              description: { type: stringType },
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'remove', data: { before: oldElement.fields.address } },
                { action: 'add', data: { after: newElement.fields.description } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
            expect(Object.keys(updatedObj.fields)).toEqual(Object.keys(newElement.fields))
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
              description: { type: stringType },
            },
            annotations: {
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          const newElement = new ObjectType({
            elemID: mockElemID,
            fields: oldElement.fields,
            annotations: {
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: oldElement, after: newElement } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
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
              address: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Address__c',
                  [constants.LABEL]: 'Address',
                },
              },
              banana: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                  [constants.LABEL]: 'Banana',
                },
              },
              cat: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Cat__c',
                  [constants.LABEL]: 'Cat',
                },
              },
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
              banana: oldElement.fields.banana.clone({
                [constants.API_NAME]: 'Test__c.Banana__c',
                [constants.LABEL]: 'Banana Split',
              }),
              cat: oldElement.fields.cat,
              description: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Description__c',
                  [constants.LABEL]: 'Description',
                },
              },
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'remove', data: { before: oldElement.fields.address } },
                { action: 'modify',
                  data: {
                    before: oldElement.fields.banana,
                    after: newElement.fields.banana,
                  } },
                { action: 'add', data: { after: newElement.fields.description } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
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
              address: { type: stringType },
              banana: { type: stringType },
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
              address: oldElement.fields.address.clone({ [constants.API_NAME]: 'Test__c.Address__c' }),
              banana: oldElement.fields.banana.clone({ [constants.API_NAME]: 'Test__c.Banana__c' }),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: oldElement, after: newElement } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
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
              banana: {
                type: stringType,
                annotations: {
                  [constants.API_NAME]: 'Test__c.Banana__c',
                },
              },
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
              banana: oldElement.fields.banana.clone({
                [constants.LABEL]: 'Banana Split',
                [constants.API_NAME]: 'Test__c.Banana__c',
              }),
            },
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test2 label',
              [constants.API_NAME]: 'Test__c',
            },
          })

          beforeEach(async () => {
            result = await adapter.deploy({
              groupID: oldElement.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: oldElement, after: newElement } },
                { action: 'modify',
                  data: { before: oldElement.fields.banana,
                    after: newElement.fields.banana } },
              ],
            })
          })

          it('should return change applied to the element', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
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
      const deployTypeId = new ElemID(constants.SALESFORCE,
        constants.ASSIGNMENT_RULES_METADATA_TYPE)
      const deployType = new ObjectType({
        elemID: deployTypeId,
        annotations: {
          [constants.METADATA_TYPE]: 'AssignmentRules',
        },
        fields: {
          dummy: { type: BuiltinTypes.STRING },
        },
      })

      let before: InstanceElement
      let after: InstanceElement
      beforeEach(() => {
        before = new InstanceElement(
          'deploy_inst',
          deployType.clone(),
          { dummy: 'before' },
        )
        after = before.clone()
        after.value.dummy = 'after'
      })

      describe('when the deploy call succeeds', () => {
        it('should update with deploy for specific types', async () => {
          await adapter.deploy({
            groupID: before.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before, after } }],
          })
          expect(mockDeploy).toHaveBeenCalled()
          expect(mockUpdate).not.toHaveBeenCalled()
        })
      })

      describe('when the deploy call should not be triggered', () => {
        it('should not update with deploy for unsupported types even if listed', async () => {
          before.type.annotations[constants.METADATA_TYPE] = 'UnsupportedType'
          after.type.annotations[constants.METADATA_TYPE] = 'UnsupportedType'
          await adapter.deploy({
            groupID: before.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before, after } }],
          })
          expect(mockDeploy).not.toHaveBeenCalled()
          expect(mockUpdate).not.toHaveBeenCalled()
        })
        it('should not update with deploy not listed types', async () => {
          before.type.annotations[constants.METADATA_TYPE] = 'NotListedType'
          after.type.annotations[constants.METADATA_TYPE] = 'NotListedType'
          await adapter.deploy({
            groupID: before.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before, after } }],
          })
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

        let result: DeployResult

        beforeEach(async () => {
          connection.metadata.deploy = jest.fn().mockImplementationOnce(
            () => ({
              complete: () => getDeployResult(false, [
                getDeployDetails('Component', 'InstName', 'my error'),
                getDeployDetails('Component', 'OtherInst', 'some error'),
              ]),
            })
          )
          result = await adapter.deploy({
            groupID: before.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before, after } }],
          })
        })

        it('should not apply changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should return error', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toMatch(
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
        await adapter.deploy({
          groupID: beforeWorkflowInstance.elemID.getFullName(),
          changes: [{
            action: 'modify',
            data: { before: beforeWorkflowInstance, after: beforeWorkflowInstance.clone() },
          }],
        })
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
      await adapter.deploy({
        groupID: beforeFlowInstance.elemID.getFullName(),
        changes: [{
          action: 'modify',
          data: { before: beforeFlowInstance, after: beforeFlowInstance.clone() },
        }],
      })
      expect(mockUpdate.mock.calls.length).toBe(0)
      expect(mockUpsert.mock.calls.length).toBe(1)
    })
  })
})
