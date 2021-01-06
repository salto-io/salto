/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, BuiltinTypes, DeployResult, ReferenceExpression, isRemovalChange, getChangeElement, isInstanceElement, ChangeGroup, isModificationChange, isAdditionChange, CORE_ANNOTATIONS, PrimitiveType, PrimitiveTypes } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { BulkLoadOperation, BulkOptions, Record as SfRecord, Batch } from 'jsforce'
import { EventEmitter } from 'events'
import { Types } from '../src/transformers/transformer'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import Connection from '../src/client/jsforce'
import mockAdapter from './adapter'

describe('Custom Object Instances CRUD', () => {
  let adapter: SalesforceAdapter
  let result: DeployResult

  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const instanceName = 'Instance'
  const anotherInstanceName = 'AnotherInstance'

  const customObject = new ObjectType({
    elemID: mockElemID,
    fields: {
      Id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [constants.API_NAME]: 'Id',
        },
      },
      SaltoName: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.API_NAME]: 'SaltoName',
        },
      },
      NumField: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.API_NAME]: 'NumField',
        },
      },
      NotCreatable: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: false,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.API_NAME]: 'NotCreatable',
        },
      },
      AnotherField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.API_NAME]: 'AnotherField',
        },
      },
      Address: {
        refType: createRefToElmWithValue(Types.compoundDataTypes.Address),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.API_NAME]: 'Address',
        },
      },
      Name: {
        refType: createRefToElmWithValue(Types.compoundDataTypes.Name),
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.API_NAME]: 'Name',
        },
      },
    },
    annotationRefsOrTypes: {},
    annotations: {
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      [constants.API_NAME]: 'Type',
    },
  })
  const existingInstance = new InstanceElement(
    instanceName,
    customObject,
    {
      SaltoName: 'existingInstance',
      NotCreatable: 'DontSendMeOnCreate',
      NumField: 1,
      Address: {
        city: 'Tel-Aviv',
        country: 'Israel',
      },
      Name: {
        FirstName: 'first',
        LastName: 'last',
        Salutation: 'mrs.',
      },
    }
  )
  const existingInstanceRecordValues = {
    attributes: {
      type: 'Type',
    },
    Id: 'queryId',
    SaltoName: 'existingInstance',
    NumField: 1,
    Address: {
      city: 'Tel-Aviv',
      country: 'Israel',
      postalCode: null,
    },
    FirstName: 'first',
    LastName: 'last',
    Salutation: 'mrs.',
  }
  const anotherExistingInstance = new InstanceElement(
    anotherInstanceName,
    customObject,
    {
      SaltoName: 'anotherExistingInstanceWithThing\'',
      NotCreatable: 'DontSendMeOnCreate',
    }
  )
  const anotherExistingInstanceRecordValues = {
    attributes: {
      type: 'Type',
    },
    Id: 'anotherQueryId',
    SaltoName: 'anotherExistingInstanceWithThing\'',
    NumField: null,
  }
  const newInstanceWithRefName = 'newInstanceWithRef'
  const newInstanceWithRef = new InstanceElement(
    newInstanceWithRefName,
    customObject,
    {
      SaltoName: 'newInstanceWithRef',
      AnotherField: new ReferenceExpression(mockElemID, 'Type'),
      NumField: 2,
    }
  )
  const anotherNewInstanceName = 'anotherNewInstance'
  const anotherNewInstance = new InstanceElement(
    anotherNewInstanceName,
    customObject,
    {
      SaltoName: 'anotherNewInstance',
      NumField: 3,
      Address: {
        city: 'Ashkelon',
        country: 'Israel',
      },
    }
  )

  describe('When adapter defined with dataManagement config', () => {
    let connection: Connection
    let mockBulkLoad: jest.Mock
    let partialBulkLoad: jest.Mock
    const errorMsgs = [
      'Error message1',
      'Error message2',
    ]
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
              id: res.Id || `newId${index}`,
              success: !isError(index),
              errors: isError(index) ? errorMsgs : [],
            })))),
            job: loadEmitter,
          }
        }
      ))

    // Should include the error msgs and the instance name
    const validateErrorMsg = (errMsg: string, instName: string): void => {
      expect(errMsg.includes(instName)).toBeTruthy()
      errorMsgs.forEach(msg =>
        expect(errMsg.includes(msg)))
    }
    beforeEach(() => {
      ({ connection, adapter } = mockAdapter({
        adapterParams: {
          filterCreators: [],
          config: {
            fetch: {
              data: {
                includeObjects: ['Test'],
                saltoIDSettings: {
                  defaultIdFields: ['SaltoName', 'NumField', 'Address', 'Name'],
                },
              },
            },
          },
        },
      }))
      mockBulkLoad = getBulkLoadMock('success')
      partialBulkLoad = getBulkLoadMock('partial')
      connection.bulk.load = mockBulkLoad
    })

    describe('Properly handle creation of list custom settings', () => {
      let mockQuery: jest.Mock
      const stringType = new PrimitiveType({
        elemID: new ElemID(constants.SALESFORCE, 'Text'),
        primitive: PrimitiveTypes.STRING,
        annotationRefsOrTypes: {
          [constants.LABEL]: BuiltinTypes.STRING,
        },
      })
      const idType = new PrimitiveType({
        elemID: new ElemID('id'),
        primitive: PrimitiveTypes.STRING,
      })
      const basicFields = {
        Id: {
          refType: createRefToElmWithValue(idType),
          label: 'id',
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.LABEL]: 'Record ID',
            [constants.API_NAME]: 'Id',
          },
        },
        Name: {
          refType: createRefToElmWithValue(stringType),
          label: 'Name',
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.LABEL]: 'Name',
            [constants.API_NAME]: 'Name',
            [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          },
        },
        // eslint-disable-next-line @typescript-eslint/camelcase
        TestField__c: {
          label: 'TestField',
          refType: createRefToElmWithValue(stringType),
          annotations: {
            [constants.LABEL]: 'TestField',
            [constants.API_NAME]: 'Type.TestField__c',
            [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          },
          annotationRefsOrTypes: {
            [constants.LABEL]: BuiltinTypes.STRING,
            [constants.API_NAME]: BuiltinTypes.STRING,
          },
        },
      }
      const customSettingsObject = new ObjectType({
        elemID: new ElemID('salesforce'),
        annotations: {
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.CUSTOM_SETTINGS_TYPE]: constants.LIST_CUSTOM_SETTINGS_TYPE,
          [constants.API_NAME]: 'Type',
        },
        fields: basicFields,
      })
      const existingSettingRecord = {
        // eslint-disable-next-line @typescript-eslint/camelcase
        TestField__c: 'somevalue',
        Id: 'a014W00000zMPT6QAO',
        Name: 'TestName1',
      }
      const nonExistingSettingRecord = {
        Name: 'TestName2',
        // eslint-disable-next-line @typescript-eslint/camelcase
        TestField__c: 'somevalue2',
        Id: 'a014W00000zNPT6QAO',
      }
      const existingSettingInstance = new InstanceElement(
        instanceName,
        customSettingsObject,
        existingSettingRecord,
      )
      const nonExistingSettingInstance = new InstanceElement(
        anotherInstanceName,
        customSettingsObject,
        nonExistingSettingRecord,
      )

      beforeEach(async () => {
        mockQuery = jest.fn().mockImplementation(async () => (
          {
            totalSize: 1,
            done: true,
            records: [existingSettingRecord],
          }))
        connection.query = mockQuery
        result = await adapter.deploy({
          changeGroup: {
            groupID: 'add_Test_instances',
            changes: [
              { action: 'add', data: { after: existingSettingInstance } },
              { action: 'add', data: { after: nonExistingSettingInstance } },
            ],
          },
        })
      })
      it('Should query according to instance values', () => {
        expect(mockQuery.mock.calls).toHaveLength(1)
        expect(mockQuery.mock.calls[0][0]).toEqual('SELECT Id,Name FROM Type WHERE Name IN (\'TestName1\',\'TestName2\')')
      })

      it('Should call load operation twice - once with insert once with update', () => {
        expect(mockBulkLoad.mock.calls).toHaveLength(2)
        const insertCall = mockBulkLoad.mock.calls.find(call => call[1] === 'insert')
        expect(insertCall).toBeDefined()
        const updateCall = mockBulkLoad.mock.calls.find(call => call[1] === 'update')
        expect(updateCall).toBeDefined()
      })
      it('Should call load operation with update for the "existing" record', () => {
        const updateCall = mockBulkLoad.mock.calls.find(call => call[1] === 'update')
        expect(updateCall).toHaveLength(4)
        expect(updateCall[0]).toBe('Type')

        // Record
        expect(updateCall[3]).toHaveLength(1)
        expect(updateCall[3][0].Id).toBeDefined()
        expect(updateCall[3][0].Id).toEqual(existingSettingInstance.value.Id)
      })

      it('Should call load operation with insert for the "new" record', () => {
        const insertCall = mockBulkLoad.mock.calls.find(call => call[1] === 'insert')
        expect(insertCall.length).toBe(4)
        expect(insertCall[0]).toBe('Type')

        // Record
        expect(insertCall[3]).toHaveLength(1)
        expect(insertCall[3][0].Name).toBeDefined()
        expect(insertCall[3][0].Name).toEqual('TestName2')
      })

      it('Should have result with 2 applied changes, add 2 instances with new Id', async () => {
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)

        // existingInstance appliedChange
        const existingInstanceChangeElement = result.appliedChanges
          .map(getChangeElement)
          .find(element => element.elemID
            .isEqual(existingSettingInstance.elemID)) as InstanceElement
        expect(existingInstanceChangeElement).toBeDefined()
        expect(existingInstanceChangeElement.value.Name).toBeDefined()
        expect(existingInstanceChangeElement.value.Name).toBe('TestName1')

        // newInstnace appliedChange
        const newInstanceChangeElement = result.appliedChanges
          .map(getChangeElement)
          .find(element => element.elemID
            .isEqual(nonExistingSettingInstance.elemID)) as InstanceElement
        expect(newInstanceChangeElement.elemID).toEqual(nonExistingSettingInstance.elemID)
        expect(newInstanceChangeElement.value.Name).toBeDefined()
        expect(newInstanceChangeElement.value.Name).toBe('TestName2')
      })
    })

    describe('When valid add group', () => {
      let mockQuery: jest.Mock

      describe('When loadBulk succeeds for all', () => {
        describe('When called with both new and existing instances', () => {
          beforeEach(async () => {
            mockQuery = jest.fn().mockImplementation(async () => (
              {
                totalSize: 1,
                done: true,
                records: [existingInstanceRecordValues],
              }))
            connection.query = mockQuery
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'add_Test_instances',
                changes: [
                  { action: 'add', data: { after: existingInstance } },
                  { action: 'add', data: { after: newInstanceWithRef } },
                ],
              },
            })
          })

          it('Should query according to instance values', () => {
            expect(mockQuery.mock.calls).toHaveLength(1)
            expect(mockQuery.mock.calls[0][0]).toEqual('SELECT Id,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN (\'existingInstance\',\'newInstanceWithRef\') AND NumField IN (1,2) AND City IN (\'Tel-Aviv\',null) AND Country IN (\'Israel\',null) AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN (\'first\',null) AND LastName IN (\'last\',null) AND Salutation IN (\'mrs.\',null) AND MiddleName IN (null) AND Suffix IN (null)')
          })

          it('Should call load operation twice - once with insert once with update', () => {
            expect(mockBulkLoad.mock.calls).toHaveLength(2)
            const insertCall = mockBulkLoad.mock.calls.find(call => call[1] === 'insert')
            expect(insertCall).toBeDefined()
            const updateCall = mockBulkLoad.mock.calls.find(call => call[1] === 'update')
            expect(updateCall).toBeDefined()
          })

          it('Should call load operation with update for the "existing" record', () => {
            const updateCall = mockBulkLoad.mock.calls.find(call => call[1] === 'update')
            expect(updateCall).toHaveLength(4)
            expect(updateCall[0]).toBe('Type')

            // Record
            expect(updateCall[3]).toHaveLength(1)
            expect(updateCall[3][0].SaltoName).toBeDefined()
            expect(updateCall[3][0].SaltoName).toEqual('existingInstance')
            // Because it turns into an update it should send it
            expect(updateCall[3][0].NotCreatable).toBeDefined()
            expect(updateCall[3][0].NotCreatable).toEqual('DontSendMeOnCreate')
          })

          it('Should call load operation with insert for the "new" record', () => {
            const insertCall = mockBulkLoad.mock.calls.find(call => call[1] === 'insert')
            expect(insertCall.length).toBe(4)
            expect(insertCall[0]).toBe('Type')

            // Record
            expect(insertCall[3]).toHaveLength(1)
            expect(insertCall[3][0].SaltoName).toBeDefined()
            expect(insertCall[3][0].SaltoName).toEqual('newInstanceWithRef')
            expect(insertCall[3][0].NotCreatable).toBeUndefined()
            expect(insertCall[3][0].AnotherField).toBeDefined()
            expect(insertCall[3][0].AnotherField).toEqual('Type')
          })

          it('Should have result with 2 applied changes, add 2 instances with new Id', async () => {
            expect(result.errors).toHaveLength(0)
            expect(result.appliedChanges).toHaveLength(2)

            // existingInstance appliedChange
            const existingInstanceChangeElement = result.appliedChanges
              .map(getChangeElement)
              .find(element => element.elemID.isEqual(existingInstance.elemID)) as InstanceElement
            expect(existingInstanceChangeElement).toBeDefined()
            expect(existingInstanceChangeElement.value.SaltoName).toBeDefined()
            expect(existingInstanceChangeElement.value.SaltoName).toBe('existingInstance')
            // Should add result (query) Id
            expect(existingInstanceChangeElement.value.Id).toBeDefined()
            expect(existingInstanceChangeElement.value.Id).toEqual('queryId')

            // newInstnace appliedChange
            const newInstanceChangeElement = result.appliedChanges
              .map(getChangeElement)
              .find(element => element.elemID.isEqual(newInstanceWithRef.elemID)) as InstanceElement
            expect(newInstanceChangeElement.elemID).toEqual(newInstanceWithRef.elemID)
            expect(newInstanceChangeElement.value.SaltoName).toBeDefined()
            expect(newInstanceChangeElement.value.SaltoName).toBe('newInstanceWithRef')
            // Should add result Id
            expect(newInstanceChangeElement.value.Id).toBeDefined()
            expect(newInstanceChangeElement.value.Id).toEqual('newId0')

            // Reference should stay a referece
            expect(newInstanceChangeElement.value.AnotherField)
              .toEqual(new ReferenceExpression(mockElemID, 'Type'))
          })
        })
        describe('When called with only new instances', () => {
          beforeEach(async () => {
            mockQuery = jest.fn().mockImplementation(async () => (
              {
                totalSize: 0,
                done: true,
                records: [],
              }))
            connection.query = mockQuery
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'add_Test_instances',
                changes: [
                  { action: 'add', data: { after: newInstanceWithRef } },
                  { action: 'add', data: { after: anotherNewInstance } },
                ],
              },
            })
          })

          it('Should query according to instance values', () => {
            expect(mockQuery.mock.calls).toHaveLength(1)
            expect(mockQuery.mock.calls[0][0]).toEqual('SELECT Id,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN (\'newInstanceWithRef\',\'anotherNewInstance\') AND NumField IN (2,3) AND City IN (null,\'Ashkelon\') AND Country IN (null,\'Israel\') AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN (null) AND LastName IN (null) AND Salutation IN (null) AND MiddleName IN (null) AND Suffix IN (null)')
          })

          it('Should call load operation once with insert', () => {
            expect(mockBulkLoad.mock.calls.length).toBe(1)
            const insertCall = mockBulkLoad.mock.calls.find(call => call[1] === 'insert')
            expect(insertCall).toBeDefined()
          })

          it('Should have result with 2 applied changes, add 2 instances with insert Id', async () => {
            expect(result.errors).toHaveLength(0)
            expect(result.appliedChanges).toHaveLength(2)
            // newInstnace appliedChange
            const newInstanceChangeElement = result.appliedChanges
              .map(getChangeElement)
              .find(element => element.elemID.isEqual(newInstanceWithRef.elemID)) as InstanceElement
            expect(newInstanceChangeElement.elemID).toEqual(newInstanceWithRef.elemID)
            expect(newInstanceChangeElement.value.SaltoName).toBeDefined()
            expect(newInstanceChangeElement.value.SaltoName).toBe('newInstanceWithRef')
            // Should add result Id
            expect(newInstanceChangeElement.value.Id).toBeDefined()
            expect(newInstanceChangeElement.value.Id).toEqual('newId0')

            // Reference should stay a referece
            expect(newInstanceChangeElement.value.AnotherField)
              .toEqual(new ReferenceExpression(mockElemID, 'Type'))

            // anotherNewInstance appliedChange
            const anotherNewInstanceChangeElement = result.appliedChanges
              .map(getChangeElement)
              .find(element => element.elemID.isEqual(anotherNewInstance.elemID)) as InstanceElement
            expect(anotherNewInstanceChangeElement).toBeDefined()
            expect(anotherNewInstanceChangeElement.value.SaltoName).toBeDefined()
            expect(anotherNewInstanceChangeElement.value.SaltoName).toBe('anotherNewInstance')
            // Should add result Id
            expect(anotherNewInstanceChangeElement.value.Id).toBeDefined()
            expect(anotherNewInstanceChangeElement.value.Id).toEqual('newId1')
          })
        })
        describe('When called with only existing instances', () => {
          beforeEach(async () => {
            mockQuery = jest.fn().mockImplementation(async () => (
              {
                totalSize: 2,
                done: true,
                records: [existingInstanceRecordValues, anotherExistingInstanceRecordValues],
              }))
            connection.query = mockQuery
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'add_Test_instances',
                changes: [
                  { action: 'add', data: { after: existingInstance } },
                  { action: 'add', data: { after: anotherExistingInstance } },
                ],
              },
            })
          })

          it('Should query according to instance values', () => {
            expect(mockQuery.mock.calls).toHaveLength(1)
            expect(mockQuery.mock.calls[0][0]).toEqual('SELECT Id,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN (\'existingInstance\',\'anotherExistingInstanceWithThing\\\'\') AND NumField IN (1,null) AND City IN (\'Tel-Aviv\',null) AND Country IN (\'Israel\',null) AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN (\'first\',null) AND LastName IN (\'last\',null) AND Salutation IN (\'mrs.\',null) AND MiddleName IN (null) AND Suffix IN (null)')
          })

          it('Should call load operation once with update', () => {
            expect(mockBulkLoad.mock.calls.length).toBe(1)
            const updateCall = mockBulkLoad.mock.calls.find(call => call[1] === 'update')
            expect(updateCall).toBeDefined()
          })

          it('Should have result with 2 applied changes, add 2 instances with insert Id', async () => {
            expect(result.errors).toHaveLength(0)
            expect(result.appliedChanges).toHaveLength(2)

            // existingInstance appliedChange
            const existingInstanceChangeElement = result.appliedChanges
              .map(getChangeElement)
              .find(element => element.elemID.isEqual(existingInstance.elemID)) as InstanceElement
            expect(existingInstanceChangeElement).toBeDefined()
            expect(existingInstanceChangeElement.value.SaltoName).toBeDefined()
            expect(existingInstanceChangeElement.value.SaltoName).toBe('existingInstance')
            // Should add result Id
            expect(existingInstanceChangeElement.value.Id).toBeDefined()
            expect(existingInstanceChangeElement.value.Id).toEqual('queryId')

            // anotherExistingInstance appliedChange
            const anotherExistingInstanceChangeElement = result.appliedChanges
              .map(getChangeElement)
              .find(element =>
                element.elemID.isEqual(anotherExistingInstance.elemID)) as InstanceElement
            expect(anotherExistingInstanceChangeElement.elemID)
              .toEqual(anotherExistingInstance.elemID)
            expect(anotherExistingInstanceChangeElement.value.SaltoName).toBeDefined()
            expect(anotherExistingInstanceChangeElement.value.SaltoName).toBe('anotherExistingInstanceWithThing\'')
            // Should add result Id
            expect(anotherExistingInstanceChangeElement.value.Id).toBeDefined()
            expect(anotherExistingInstanceChangeElement.value.Id).toEqual('anotherQueryId')
          })
        })
      })

      describe('When loadBulk partially succeeds', () => {
        beforeEach(async () => {
          mockQuery = jest.fn().mockImplementation(async () => (
            {
              totalSize: 2,
              done: true,
              records: [existingInstanceRecordValues, anotherExistingInstanceRecordValues],
            }))
          connection.query = mockQuery
          connection.bulk.load = partialBulkLoad
          result = await adapter.deploy({
            changeGroup: {
              groupID: 'add_Test_instances',
              changes: [
                { action: 'add', data: { after: existingInstance } },
                { action: 'add', data: { after: newInstanceWithRef } },
                { action: 'add', data: { after: anotherExistingInstance } },
                { action: 'add', data: { after: anotherNewInstance } },
                { action: 'add', data: { after: newInstanceWithRef } },
                { action: 'add', data: { after: anotherNewInstance } },
              ],
            },
          })
        })
        it('Should query according to instance values', () => {
          expect(mockQuery.mock.calls).toHaveLength(1)
          expect(mockQuery.mock.calls[0][0]).toEqual('SELECT Id,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN (\'existingInstance\',\'newInstanceWithRef\',\'anotherExistingInstanceWithThing\\\'\',\'anotherNewInstance\') AND NumField IN (1,2,null,3) AND City IN (\'Tel-Aviv\',null,\'Ashkelon\') AND Country IN (\'Israel\',null) AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN (\'first\',null) AND LastName IN (\'last\',null) AND Salutation IN (\'mrs.\',null) AND MiddleName IN (null) AND Suffix IN (null)')
        })

        it('Should call load operation both with update and with insert', () => {
          expect(partialBulkLoad.mock.calls.length).toBe(2)
          const insertCall = partialBulkLoad.mock.calls.find(call => call[1] === 'insert')
          expect(insertCall).toBeDefined()
          const updateCall = partialBulkLoad.mock.calls.find(call => call[1] === 'update')
          expect(updateCall).toBeDefined()
        })

        it('Should have three errors (1 for update and 2 for add)', () => {
          expect(result.errors).toHaveLength(3)
          validateErrorMsg(result.errors[0].message, 'newInstanceWithRef')
          validateErrorMsg(result.errors[1].message, 'newInstanceWithRef')
          validateErrorMsg(result.errors[2].message, 'Instance')
        })

        it('Should have three applied add change with the right ids', () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(isAdditionChange(result.appliedChanges[0])).toBeTruthy()
          const changeElement = getChangeElement(result.appliedChanges[0])
          expect(changeElement).toBeDefined()
          expect(isInstanceElement(changeElement)).toBeTruthy()
          expect((changeElement as InstanceElement).value[constants.CUSTOM_OBJECT_ID_FIELD]).toBe('newId1')
          expect(isAdditionChange(result.appliedChanges[1])).toBeTruthy()
          const anotherChangeElement = getChangeElement(result.appliedChanges[1])
          expect(anotherChangeElement).toBeDefined()
          expect(isInstanceElement(anotherChangeElement)).toBeTruthy()
          expect((anotherChangeElement as InstanceElement).value[constants.CUSTOM_OBJECT_ID_FIELD]).toBe('newId3')
          expect(isAdditionChange(result.appliedChanges[2])).toBeTruthy()
          const anotherNewChangeElement = getChangeElement(result.appliedChanges[2])
          expect(anotherNewChangeElement).toBeDefined()
          expect(isInstanceElement(anotherNewChangeElement)).toBeTruthy()
          expect((anotherNewChangeElement as InstanceElement).value[constants.CUSTOM_OBJECT_ID_FIELD]).toBe('anotherQueryId')
        })
      })
    })

    describe('When valid modify group', () => {
      const instanceToModify = existingInstance.clone()
      instanceToModify.value.Id = 'modifyId'
      const anotherInstanceToModify = anotherExistingInstance.clone()
      anotherInstanceToModify.value.Id = 'anotherModifyId'
      const modifyDeployGroup = {
        groupID: 'modify__Test__c',
        changes: [
          { action: 'modify', data: { before: instanceToModify, after: instanceToModify } },
          { action: 'modify', data: { before: anotherInstanceToModify, after: anotherInstanceToModify } },
        ],
      } as ChangeGroup
      describe('when loadBulk succeeds for all', () => {
        beforeEach(async () => {
          result = await adapter.deploy({ changeGroup: modifyDeployGroup })
        })

        it('should return no errors and 2 fitting applied changes', async () => {
          expect(result.errors).toHaveLength(0)
          expect(result.appliedChanges).toHaveLength(2)
          expect(isModificationChange(result.appliedChanges[0])).toBeTruthy()
          const changeElement = getChangeElement(result.appliedChanges[0])
          expect(changeElement).toBeDefined()
          expect(isInstanceElement(changeElement)).toBeTruthy()
          expect(isModificationChange(result.appliedChanges[1])).toBeTruthy()
          const secondChangeElement = getChangeElement(result.appliedChanges[1])
          expect(secondChangeElement).toBeDefined()
          expect(isInstanceElement(secondChangeElement)).toBeTruthy()
        })
      })

      describe('when loadBulk partially succeeds', () => {
        beforeEach(async () => {
          connection.bulk.load = partialBulkLoad
          result = await adapter.deploy({ changeGroup: modifyDeployGroup })
        })

        it('should return one error and one applied change', async () => {
          expect(result.errors).toHaveLength(1)
          validateErrorMsg(result.errors[0].message, 'Instance')
          expect(result.appliedChanges).toHaveLength(1)
          expect(isModificationChange(result.appliedChanges[0])).toBeTruthy()
          const changeElement = getChangeElement(result.appliedChanges[0])
          expect(changeElement).toBeDefined()
          expect(isInstanceElement(changeElement)).toBeTruthy()
        })
      })

      describe('when loadBulk fails for all', () => {
        beforeEach(async () => {
          connection.bulk.load = getBulkLoadMock('fail')
          result = await adapter.deploy({ changeGroup: modifyDeployGroup })
        })

        it('should return only errors', async () => {
          expect(result.errors).toHaveLength(2)
          validateErrorMsg(result.errors[0].message, 'Instance')
          validateErrorMsg(result.errors[1].message, 'AnotherInstance')
          expect(result.appliedChanges).toHaveLength(0)
        })
      })
    })

    describe('when valid remove group', () => {
      const instanceToDelete = existingInstance.clone()
      instanceToDelete.value.Id = 'deleteId'
      const anotherInstanceToDelete = anotherExistingInstance.clone()
      anotherInstanceToDelete.value.Id = 'anotherDeleteId'
      const removeChangeGroup = {
        groupID: 'delete__Test__c',
        changes: [
          { action: 'remove', data: { before: instanceToDelete } },
          { action: 'remove', data: { before: anotherInstanceToDelete } },
        ],
      } as ChangeGroup
      describe('when loadBulk succeeds for all', () => {
        beforeEach(async () => {
          result = await adapter.deploy({ changeGroup: removeChangeGroup })
        })

        it('should return no errors and 2 fitting applied changes', () => {
          expect(result.errors).toHaveLength(0)
          expect(result.appliedChanges).toHaveLength(2)
          expect(isRemovalChange(result.appliedChanges[0])).toBeTruthy()
          const changeElement = getChangeElement(result.appliedChanges[0])
          expect(changeElement).toBeDefined()
          expect(isInstanceElement(changeElement)).toBeTruthy()
          expect(isRemovalChange(result.appliedChanges[1])).toBeTruthy()
          const secondChangeElement = getChangeElement(result.appliedChanges[1])
          expect(secondChangeElement).toBeDefined()
          expect(isInstanceElement(secondChangeElement)).toBeTruthy()
        })
      })

      describe('when loadBulk partially succeeds', () => {
        describe('when loadBulk succeeds for all', () => {
          beforeEach(async () => {
            connection.bulk.load = partialBulkLoad
            result = await adapter.deploy({ changeGroup: removeChangeGroup })
          })

          it('should return one error', () => {
            expect(result.errors).toHaveLength(1)
            validateErrorMsg(result.errors[0].message, 'Instance')
          })

          it('should return one applied change', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(isRemovalChange(result.appliedChanges[0])).toBeTruthy()
            const changeElement = getChangeElement(result.appliedChanges[0])
            expect(changeElement).toBeDefined()
            expect(isInstanceElement(changeElement)).toBeTruthy()
          })
        })

        describe('when loadBulk fails for all', () => {
          beforeEach(async () => {
            connection.bulk.load = getBulkLoadMock('fail')
            result = await adapter.deploy({ changeGroup: removeChangeGroup })
          })

          it('should return only errors', () => {
            expect(result.errors).toHaveLength(2)
            validateErrorMsg(result.errors[1].message, 'Instance')
            validateErrorMsg(result.errors[1].message, 'AnotherInstance')
            expect(result.appliedChanges).toHaveLength(0)
          })
        })
      })

      describe('When group has more than one type', () => {
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
        describe('Add group', () => {
          it('should fail', async () => {
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'badGroup',
                changes: [
                  { action: 'add', data: { after: existingInstance } },
                  { action: 'add', data: { after: instanceOfAnotherType } },
                ],
              },
            })
          })
        })
        describe('Modify group', () => {
          it('should fail', async () => {
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'badGroup',
                changes: [
                  { action: 'modify', data: { before: existingInstance, after: existingInstance } },
                  { action: 'modify', data: { before: instanceOfAnotherType, after: instanceOfAnotherType } },
                ],
              },
            })
          })
        })
        describe('Remove group', () => {
          it('should fail', async () => {
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'badGroup',
                changes: [
                  { action: 'remove', data: { before: existingInstance } },
                  { action: 'remove', data: { before: instanceOfAnotherType } },
                ],
              },
            })
          })
        })
        afterEach(() => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Custom Object Instances change group should have a single type but got: Type,anotherType'))
        })
      })

      describe('When modify group tries to modify 2 diff instances', () => {
        const instanceToModify = existingInstance.clone()
        instanceToModify.value.Id = 'modifyId'
        const anotherInstanceToModify = anotherExistingInstance.clone()
        anotherInstanceToModify.value.Id = 'anotherModifyId'
        it('Should return error', async () => {
          result = await adapter.deploy({
            changeGroup: {
              groupID: 'invalidModifyGroup',
              changes: [
                { action: 'modify', data: { before: instanceToModify, after: anotherInstanceToModify } },
              ],
            },
          })
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Failed to update as api name prev=modifyId and new=anotherModifyId are different'))
        })
      })

      describe('When group has more than one action', () => {
        it('Should return with an error', async () => {
          result = await adapter.deploy({
            changeGroup: {
              groupID: 'multipleActionsGroup',
              changes: [
                { action: 'add', data: { after: existingInstance } },
                { action: 'remove', data: { before: newInstanceWithRef } },
              ],
            },
          })
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0]).toEqual(new Error('Custom Object Instances change group must have one action'))
        })
      })
    })
  })

  describe('When adapter is defined with dataManagement config with invalid fields in SaltoIDSettings', () => {
    beforeEach(() => {
      ({ adapter } = mockAdapter({
        adapterParams: {
          filterCreators: [],
          config: {
            fetch: {
              data: {
                includeObjects: ['Test'],
                saltoIDSettings: {
                  defaultIdFields: ['NonExistingFields'],
                },
              },
            },
          },
        },
      }))
    })

    it('Should fail with trying to run an add group', async () => {
      result = await adapter.deploy({
        changeGroup: {
          groupID: 'add_Test_instances',
          changes: [
            { action: 'add', data: { after: existingInstance } },
          ],
        },
      })
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toEqual(new Error('Failed to add instances of type Type due to invalid SaltoIdFields - NonExistingFields'))
    })
  })

  describe('When adapter is defined without dataManagement config', () => {
    beforeEach(() => {
      ({ adapter } = mockAdapter({
        adapterParams: {
          filterCreators: [],
          config: {},
        },
      }))
    })

    describe('Add deploy group', () => {
      it('should fail', async () => {
        result = await adapter.deploy({
          changeGroup: {
            groupID: 'add_Test_instances',
            changes: [
              { action: 'add', data: { after: existingInstance } },
            ],
          },
        })
      })
    })

    describe('Modify deploy group', () => {
      it('should fail', async () => {
        result = await adapter.deploy({
          changeGroup: {
            groupID: 'modify_Test_instances',
            changes: [
              { action: 'modify', data: { before: existingInstance, after: existingInstance } },
            ],
          },
        })
      })
    })

    describe('Remove deploy group', () => {
      it('should fail', async () => {
        result = await adapter.deploy({
          changeGroup: {
            groupID: 'remove_Test_instances',
            changes: [
              { action: 'remove', data: { before: existingInstance } },
            ],
          },
        })
      })
    })

    afterEach(() => {
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toEqual(new Error('dataManagement must be defined in the salesforce.nacl config to deploy Custom Object instances'))
    })
  })
})
