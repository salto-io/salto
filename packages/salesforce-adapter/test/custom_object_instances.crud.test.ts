/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  BuiltinTypes,
  DeployResult,
  ReferenceExpression,
  isRemovalChange,
  getChangeData,
  isInstanceElement,
  ChangeGroup,
  isModificationChange,
  isAdditionChange,
  CORE_ANNOTATIONS,
  PrimitiveType,
  PrimitiveTypes,
  Change,
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import {
  BulkLoadOperation,
  BulkOptions,
  Record as SfRecord,
  Batch,
} from '@salto-io/jsforce'
import { EventEmitter } from 'events'
import { Types } from '../src/transformers/transformer'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import Connection from '../src/client/jsforce'
import mockAdapter from './adapter'
import { createCustomObjectType, nullProgressReporter } from './utils'
import {
  ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  CUSTOM_OBJECT_ID_FIELD,
  FIELD_ANNOTATIONS,
  OWNER_ID,
  SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
  DefaultSoqlQueryLimits,
  CPQ_PRICE_RULE,
  CPQ_CONDITIONS_MET,
  CPQ_PRICE_CONDITION,
  CPQ_PRICE_CONDITION_RULE_FIELD,
  ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
} from '../src/constants'
import { mockTypes } from './mock_elements'

describe('Custom Object Instances CRUD', () => {
  let adapter: SalesforceAdapter
  let result: DeployResult

  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const instanceName = 'Instance'
  const anotherInstanceName = 'AnotherInstance'
  const nameOfInstanceWithNonUpdateableField = 'NotUpdatable'

  const customObject = new ObjectType({
    elemID: mockElemID,
    fields: {
      Id: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'Id',
        },
      },
      [OWNER_ID]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: OWNER_ID,
        },
      },
      SaltoName: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'SaltoName',
        },
      },
      NumField: {
        refType: BuiltinTypes.NUMBER,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'NumField',
        },
      },
      NotCreatable: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: false,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'NotCreatable',
        },
      },
      NotUpdateable: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'NotUpdateable',
        },
      },
      AnotherField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'AnotherField',
        },
      },
      Address: {
        refType: Types.compoundDataTypes.Address,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'Address',
        },
      },
      FieldWithNoValue: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          [constants.API_NAME]: 'FieldWithNoValue',
        },
      },
      Name: {
        refType: Types.compoundDataTypes.Name,
        annotations: {
          [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
          [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
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
  const existingInstance = new InstanceElement(instanceName, customObject, {
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
  })
  const existingInstanceRecordValues = {
    attributes: {
      type: 'Type',
    },
    Id: 'queryId',
    [OWNER_ID]: 'ownerId',
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
      SaltoName: "anotherExistingInstanceWithThing'",
      NotCreatable: 'DontSendMeOnCreate',
    },
  )
  const anotherExistingInstanceRecordValues = {
    attributes: {
      type: 'Type',
    },
    Id: 'anotherQueryId',
    [OWNER_ID]: 'anotherOwnerId',
    SaltoName: "anotherExistingInstanceWithThing'",
    NumField: null,
  }
  const existingInstanceWithNonUpdateableField = new InstanceElement(
    nameOfInstanceWithNonUpdateableField,
    customObject,
    {
      SaltoName: 'existingInstanceWithNonUpdateableField',
      NotUpdateable: 'DontSendMeOnUpdate',
    },
  )
  const newInstanceWithRefName = 'newInstanceWithRef'
  const newInstanceWithRef = new InstanceElement(
    newInstanceWithRefName,
    customObject,
    {
      SaltoName: 'newInstanceWithRef',
      AnotherField: new ReferenceExpression(mockElemID, 'Type'),
      NumField: 2,
    },
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
    },
  )
  const newInstanceWithNonCreatableFieldName =
    'newInstanceWithNonCreatableField'
  const newInstanceWithNonCreatableField = new InstanceElement(
    newInstanceWithNonCreatableFieldName,
    customObject,
    {
      SaltoName: 'newInstanceWithNonCreatableField',
      NumField: 4,
      NotCreatable: 'ShouldNotBeCreated',
    },
  )
  const instanceWithMissingFields = new InstanceElement(
    'instanceWithMissingFields',
    customObject,
    {
      SaltoName: 'instanceWithMissingFields',
      NumField: 4,
      UnknownField: 'unknown',
    },
  )

  describe('When adapter defined with dataManagement config', () => {
    let connection: MockInterface<Connection>
    let mockBulkLoad: jest.Mock
    let partialBulkLoad: jest.Mock
    const errorMsgs = ['Error message1', 'Error message2']
    const getBulkLoadMock = (mode: string): jest.Mock<Batch> =>
      jest
        .fn()
        .mockImplementation(
          (
            _type: string,
            _operation: BulkLoadOperation,
            _opt?: BulkOptions,
            input?: SfRecord[],
          ) => {
            const isError = (index: number): boolean => {
              if (mode === 'fail') {
                return true
              }
              // For partial mode return error every 2nd index
              return mode === 'partial' && index % 2 === 0
            }

            const loadEmitter = new EventEmitter()
            loadEmitter.on('newListener', (_event, _listener) => {
              // This is a workaround to call emit('close')
              // that is really called as a side effect to load() inside
              // jsforce *after* our code listens on.('close')
              setTimeout(() => loadEmitter.emit('close'), 0)
            })
            return {
              then: () =>
                Promise.resolve(
                  input?.map((res, index) => ({
                    id: res.Id || `newId${index}`,
                    success: !isError(index),
                    errors: isError(index) ? errorMsgs : [],
                  })),
                ),
              job: loadEmitter,
            }
          },
        )

    beforeEach(() => {
      ;({ connection, adapter } = mockAdapter({
        adapterParams: {
          filterCreators: [],
          config: {
            fetch: {
              data: {
                includeObjects: ['Test'],
                saltoIDSettings: {
                  defaultIdFields: ['SaltoName', 'NumField', 'Address', 'Name'],
                  overrides: [
                    { objectsRegex: 'TestType__c', idFields: ['Name'] },
                    { objectsRegex: 'sbaa__ApprovalRule__c', idFields: ['Id'] },
                    {
                      objectsRegex: 'sbaa__ApprovalCondition__c',
                      idFields: ['sbaa__ApprovalRule__c'],
                    },
                    { objectsRegex: CPQ_PRICE_RULE, idFields: ['Id'] },
                    {
                      objectsRegex: CPQ_PRICE_CONDITION,
                      idFields: [CPQ_PRICE_CONDITION_RULE_FIELD],
                    },
                  ],
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
          refType: idType,
          label: 'id',
          annotations: {
            [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
            [constants.FIELD_ANNOTATIONS.UPDATEABLE]: false,
            [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.LABEL]: 'Record ID',
            [constants.API_NAME]: 'Id',
          },
        },
        Name: {
          refType: stringType,
          label: 'Name',
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [constants.LABEL]: 'Name',
            [constants.API_NAME]: 'Name',
            [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
            [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
            [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
          },
        },
        // eslint-disable-next-line camelcase
        TestField__c: {
          label: 'TestField',
          refType: stringType,
          annotations: {
            [constants.LABEL]: 'TestField',
            [constants.API_NAME]: 'Type.TestField__c',
            [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
            [constants.FIELD_ANNOTATIONS.UPDATEABLE]: true,
            [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
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
        // eslint-disable-next-line camelcase
        TestField__c: 'somevalue',
        Id: 'a014W00000zMPT6QAO',
        Name: 'TestName1',
      }
      const nonExistingSettingRecord = {
        Name: 'TestName2',
        // eslint-disable-next-line camelcase
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
        mockQuery = jest.fn().mockImplementation(async () => ({
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
          progressReporter: nullProgressReporter,
        })
      })
      it('Should query according to instance values', () => {
        expect(mockQuery.mock.calls).toHaveLength(1)
        expect(mockQuery.mock.calls[0][0]).toEqual(
          "SELECT Id,Name FROM Type WHERE Name IN ('TestName1','TestName2')",
        )
      })

      it('Should call load operation twice - once with insert once with update', () => {
        expect(mockBulkLoad.mock.calls).toHaveLength(2)
        const insertCall = mockBulkLoad.mock.calls.find(
          (call) => call[1] === 'insert',
        )
        expect(insertCall).toBeDefined()
        const updateCall = mockBulkLoad.mock.calls.find(
          (call) => call[1] === 'update',
        )
        expect(updateCall).toBeDefined()
      })
      it('Should call load operation with update for the "existing" record', () => {
        const updateCall = mockBulkLoad.mock.calls.find(
          (call) => call[1] === 'update',
        )
        expect(updateCall).toHaveLength(4)
        expect(updateCall[0]).toBe('Type')

        // Record
        expect(updateCall[3]).toHaveLength(1)
        expect(updateCall[3][0].Id).toBeDefined()
        expect(updateCall[3][0].Id).toEqual(existingSettingInstance.value.Id)
      })

      it('Should call load operation with insert for the "new" record', () => {
        const insertCall = mockBulkLoad.mock.calls.find(
          (call) => call[1] === 'insert',
        )
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
        const existingInstanceChangeData = result.appliedChanges
          .map(getChangeData)
          .find((element) =>
            element.elemID.isEqual(existingSettingInstance.elemID),
          ) as InstanceElement
        expect(existingInstanceChangeData).toBeDefined()
        expect(existingInstanceChangeData.value.Name).toBeDefined()
        expect(existingInstanceChangeData.value.Name).toBe('TestName1')

        // newInstance appliedChange
        const newInstanceChangeData = result.appliedChanges
          .map(getChangeData)
          .find((element) =>
            element.elemID.isEqual(nonExistingSettingInstance.elemID),
          ) as InstanceElement
        expect(newInstanceChangeData.elemID).toEqual(
          nonExistingSettingInstance.elemID,
        )
        expect(newInstanceChangeData.value.Name).toBeDefined()
        expect(newInstanceChangeData.value.Name).toBe('TestName2')
      })
    })

    describe('When valid add group', () => {
      let mockQuery: jest.Mock

      describe('When loadBulk succeeds for all', () => {
        describe('When called with both new and existing instances', () => {
          beforeEach(async () => {
            mockQuery = jest.fn().mockImplementation(async () => ({
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
                  {
                    action: 'add',
                    data: { after: newInstanceWithNonCreatableField },
                  },
                  { action: 'add', data: { after: instanceWithMissingFields } },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })

          it('Should query according to instance values', () => {
            expect(mockQuery.mock.calls).toHaveLength(1)
            expect(mockQuery.mock.calls[0][0]).toEqual(
              "SELECT Id,OwnerId,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN ('existingInstance','newInstanceWithRef','newInstanceWithNonCreatableField','instanceWithMissingFields') AND NumField IN (1,2,4) AND City IN ('Tel-Aviv',null) AND Country IN ('Israel',null) AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN ('first',null) AND LastName IN ('last',null) AND Salutation IN ('mrs.',null) AND MiddleName IN (null) AND Suffix IN (null)",
            )
          })

          it('Should call load operation twice - once with insert once with update', () => {
            expect(mockBulkLoad.mock.calls).toHaveLength(2)
            const insertCall = mockBulkLoad.mock.calls.find(
              (call) => call[1] === 'insert',
            )
            expect(insertCall).toBeDefined()
            const updateCall = mockBulkLoad.mock.calls.find(
              (call) => call[1] === 'update',
            )
            expect(updateCall).toBeDefined()
          })

          it('Should call load operation with update for the "existing" record', () => {
            const updateCall = mockBulkLoad.mock.calls.find(
              (call) => call[1] === 'update',
            )
            expect(updateCall).toHaveLength(4)
            expect(updateCall[0]).toBe('Type')

            // Record
            expect(updateCall[3]).toHaveLength(1)
            expect(updateCall[3][0].SaltoName).toBeDefined()
            expect(updateCall[3][0].SaltoName).toEqual('existingInstance')
            // Because it turns into an update it should send it
            expect(updateCall[3][0].NotCreatable).toBeDefined()
            expect(updateCall[3][0].NotCreatable).toEqual('DontSendMeOnCreate')
            // Should deploy fields with no values as null
            expect(updateCall[3][0].FieldWithNoValue).toBeNull()
          })

          it('Should call load operation with insert for the "new" records', () => {
            const insertCall = mockBulkLoad.mock.calls.find(
              (call) => call[1] === 'insert',
            )
            expect(insertCall.length).toBe(4)
            expect(insertCall[0]).toBe('Type')
            // Record
            expect(insertCall[3]).toHaveLength(3)

            const newInstanceWithRefRecord = insertCall[3][0]
            expect(newInstanceWithRefRecord).toHaveProperty(
              'SaltoName',
              'newInstanceWithRef',
            )
            expect(newInstanceWithRefRecord).toHaveProperty(
              'AnotherField',
              'Type',
            )
            expect(newInstanceWithRefRecord).not.toHaveProperty('NotCreatable')
            expect(newInstanceWithRefRecord).not.toHaveProperty(
              'FieldWithNoValue',
            )

            const newInstanceWithNonCreatableFieldRecord = insertCall[3][1]
            expect(newInstanceWithNonCreatableFieldRecord).toHaveProperty(
              'SaltoName',
              'newInstanceWithNonCreatableField',
            )
            expect(newInstanceWithNonCreatableFieldRecord).toHaveProperty(
              'NumField',
              4,
            )
            expect(newInstanceWithNonCreatableFieldRecord).not.toHaveProperty(
              'NotCreatable',
            )
          })

          it('Should have result with correct applied changes and add Id to the inserted instances', async () => {
            expect(result.appliedChanges).toHaveLength(4)

            // existingInstance appliedChange
            const existingInstanceChangeData = result.appliedChanges
              .map(getChangeData)
              .find((element) =>
                element.elemID.isEqual(existingInstance.elemID),
              ) as InstanceElement
            expect(existingInstanceChangeData).toBeDefined()
            expect(existingInstanceChangeData.value.SaltoName).toBeDefined()
            expect(existingInstanceChangeData.value.SaltoName).toBe(
              'existingInstance',
            )
            // Should add result (query) Id
            expect(existingInstanceChangeData.value.Id).toBeDefined()
            expect(existingInstanceChangeData.value.Id).toEqual('queryId')

            // newInstance appliedChange
            const newInstanceChangeData = result.appliedChanges
              .map(getChangeData)
              .find((element) =>
                element.elemID.isEqual(newInstanceWithRef.elemID),
              ) as InstanceElement
            expect(newInstanceChangeData.elemID).toEqual(
              newInstanceWithRef.elemID,
            )
            expect(newInstanceChangeData.value.SaltoName).toBeDefined()
            expect(newInstanceChangeData.value.SaltoName).toBe(
              'newInstanceWithRef',
            )
            // Should add result Id
            expect(newInstanceChangeData.value.Id).toBeDefined()
            expect(newInstanceChangeData.value.Id).toEqual('newId0')

            // Reference should stay a reference
            expect(newInstanceChangeData.value.AnotherField).toEqual(
              new ReferenceExpression(mockElemID, 'Type'),
            )

            // newInstanceWithNonCreatableFieldChangeData has its own test case
          })

          it('Should not insert non-creatable fields', () => {
            expect(result.errors).toSatisfyAny(
              (error) =>
                error.elemID.isEqual(newInstanceWithNonCreatableField.elemID) &&
                error.message.includes('createable') &&
                error.severity === 'Warning',
            )
            const newInstanceWithNonCreatableFieldChangeData =
              result.appliedChanges
                .map(getChangeData)
                .find((element) =>
                  element.elemID.isEqual(
                    newInstanceWithNonCreatableField.elemID,
                  ),
                ) as InstanceElement

            expect(
              newInstanceWithNonCreatableFieldChangeData.value,
            ).not.toHaveProperty('NotCreatable')
          })

          it('Should create a warning for instance with missing fields', () => {
            expect(result.errors).toSatisfyAny(
              (error) =>
                error.severity === 'Warning' &&
                error.elemID.isEqual(instanceWithMissingFields.elemID) &&
                error.message.includes(
                  'they are not defined in the type: [UnknownField]',
                ),
            )
          })
        })
        describe('When called with only new instances', () => {
          beforeEach(async () => {
            mockQuery = jest.fn().mockImplementation(async (query) =>
              // Second query should return the OwnerId to test flow of mandatory fields for update calls
              query.includes("('firstInstance','secondInstance')")
                ? {
                    totalSize: 2,
                    done: true,
                    records: [
                      {
                        Id: 'newId0',
                        Name: 'firstInstance',
                        [OWNER_ID]: 'ownerId',
                      },
                      {
                        Id: 'newId1',
                        Name: 'secondInstance',
                        [OWNER_ID]: 'ownerId',
                      },
                    ],
                  }
                : {
                    totalSize: 0,
                    done: true,
                    records: [],
                  },
            )
            connection.query = mockQuery
          })
          describe('when group has no circular dependencies', () => {
            beforeEach(async () => {
              result = await adapter.deploy({
                changeGroup: {
                  groupID: 'add_Test_instances',
                  changes: [
                    { action: 'add', data: { after: newInstanceWithRef } },
                    { action: 'add', data: { after: anotherNewInstance } },
                    {
                      action: 'add',
                      data: { after: newInstanceWithNonCreatableField },
                    },
                  ],
                },
                progressReporter: nullProgressReporter,
              })
            })

            it('Should query according to instance values', () => {
              expect(mockQuery.mock.calls).toHaveLength(1)
              expect(mockQuery.mock.calls[0][0]).toEqual(
                "SELECT Id,OwnerId,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN ('newInstanceWithRef','anotherNewInstance','newInstanceWithNonCreatableField') AND NumField IN (2,3,4) AND City IN (null,'Ashkelon') AND Country IN (null,'Israel') AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN (null) AND LastName IN (null) AND Salutation IN (null) AND MiddleName IN (null) AND Suffix IN (null)",
              )
            })

            it('Should call load operation once with insert', () => {
              expect(mockBulkLoad.mock.calls.length).toBe(1)
              const insertCall = mockBulkLoad.mock.calls.find(
                (call) => call[1] === 'insert',
              )
              expect(insertCall).toBeDefined()
            })

            it('Should have result with 3 applied changes, add 3 instances with insert Id', async () => {
              expect(result.appliedChanges).toHaveLength(3)
              // newInstance appliedChange
              const newInstanceChangeData = result.appliedChanges
                .map(getChangeData)
                .find((element) =>
                  element.elemID.isEqual(newInstanceWithRef.elemID),
                ) as InstanceElement
              expect(newInstanceChangeData.elemID).toEqual(
                newInstanceWithRef.elemID,
              )
              expect(newInstanceChangeData.value.SaltoName).toBeDefined()
              expect(newInstanceChangeData.value.SaltoName).toBe(
                'newInstanceWithRef',
              )
              // Should add result Id
              expect(newInstanceChangeData.value.Id).toBeDefined()
              expect(newInstanceChangeData.value.Id).toEqual('newId0')

              // Reference should stay a reference
              expect(newInstanceChangeData.value.AnotherField).toEqual(
                new ReferenceExpression(mockElemID, 'Type'),
              )

              // anotherNewInstance appliedChange
              const anotherNewInstanceChangeData = result.appliedChanges
                .map(getChangeData)
                .find((element) =>
                  element.elemID.isEqual(anotherNewInstance.elemID),
                ) as InstanceElement
              expect(anotherNewInstanceChangeData).toBeDefined()
              expect(anotherNewInstanceChangeData.value.SaltoName).toBeDefined()
              expect(anotherNewInstanceChangeData.value.SaltoName).toBe(
                'anotherNewInstance',
              )
              // Should add result Id
              expect(anotherNewInstanceChangeData.value.Id).toBeDefined()
              expect(anotherNewInstanceChangeData.value.Id).toEqual('newId1')
            })
            it('Should not insert non-creatable fields', () => {
              expect(result.errors).toSatisfyAny(
                (error) =>
                  error.elemID.isEqual(
                    newInstanceWithNonCreatableField.elemID,
                  ) &&
                  error.message.includes('createable') &&
                  error.severity === 'Warning',
              )
              const newInstanceWithNonCreatableFieldChangeData =
                result.appliedChanges
                  .map(getChangeData)
                  .find((element) =>
                    element.elemID.isEqual(
                      newInstanceWithNonCreatableField.elemID,
                    ),
                  ) as InstanceElement

              expect(
                newInstanceWithNonCreatableFieldChangeData.value,
              ).not.toHaveProperty('NotCreatable')
            })
          })
          describe('when group has circular dependencies', () => {
            let firstInstance: InstanceElement
            let secondInstance: InstanceElement
            let instanceWithoutRef: InstanceElement
            beforeEach(async () => {
              const objectType = createCustomObjectType('TestType__c', {
                fields: {
                  Name: {
                    refType: BuiltinTypes.STRING,
                    annotations: {
                      [FIELD_ANNOTATIONS.QUERYABLE]: true,
                      [FIELD_ANNOTATIONS.UPDATEABLE]: true,
                      [FIELD_ANNOTATIONS.CREATABLE]: true,
                      apiName: 'Name',
                    },
                  },
                  Number__c: {
                    refType: BuiltinTypes.NUMBER,
                    annotations: {
                      [FIELD_ANNOTATIONS.QUERYABLE]: true,
                      [FIELD_ANNOTATIONS.UPDATEABLE]: true,
                      [FIELD_ANNOTATIONS.CREATABLE]: true,
                    },
                  },
                  TestType__c: {
                    refType: Types.primitiveDataTypes.Lookup,
                    annotations: {
                      [FIELD_ANNOTATIONS.QUERYABLE]: true,
                      [FIELD_ANNOTATIONS.UPDATEABLE]: true,
                      [FIELD_ANNOTATIONS.CREATABLE]: true,
                    },
                  },
                  OwnerId: {
                    refType: BuiltinTypes.STRING,
                    annotations: {
                      [FIELD_ANNOTATIONS.QUERYABLE]: true,
                      [FIELD_ANNOTATIONS.UPDATEABLE]: true,
                      [FIELD_ANNOTATIONS.CREATABLE]: true,
                    },
                  },
                },
              })
              firstInstance = new InstanceElement('firstInstance', objectType, {
                Name: 'firstInstance',
                Number__c: 1,
              })
              secondInstance = new InstanceElement(
                'secondInstance',
                objectType,
                {
                  Name: 'secondInstance',
                  Number__c: 1,
                  TestType__c: new ReferenceExpression(
                    firstInstance.elemID,
                    firstInstance,
                  ),
                },
              )
              firstInstance.value.TestType__c = new ReferenceExpression(
                secondInstance.elemID,
                secondInstance,
              )
              instanceWithoutRef = new InstanceElement(
                'instanceWithoutRef',
                objectType,
                {
                  Name: 'instanceWithoutRef',
                  Number__c: 1,
                },
              )

              result = await adapter.deploy({
                changeGroup: {
                  groupID: 'add_Test_instances',
                  changes: [
                    { action: 'add', data: { after: firstInstance } },
                    { action: 'add', data: { after: secondInstance } },
                    { action: 'add', data: { after: instanceWithoutRef } },
                  ],
                },
                progressReporter: nullProgressReporter,
              })
            })
            it('should update the partially deployed instances after inserting them with mandatory field values', () => {
              expect(result.errors).toBeEmpty()
              expect(connection.bulk.load).toHaveBeenCalledTimes(2)
              expect(connection.bulk.load).toHaveBeenNthCalledWith(
                1,
                'TestType__c',
                'insert',
                expect.anything(),
                [
                  {
                    Id: undefined,
                    Name: 'firstInstance',
                    Number__c: 1,
                    TestType__c: null,
                  },
                  {
                    Id: undefined,
                    Name: 'secondInstance',
                    Number__c: 1,
                    TestType__c: null,
                  },
                  { Id: undefined, Name: 'instanceWithoutRef', Number__c: 1 },
                ],
              )
              expect(connection.bulk.load).toHaveBeenNthCalledWith(
                2,
                'TestType__c',
                'update',
                expect.anything(),
                [
                  {
                    Id: 'newId0',
                    Name: 'firstInstance',
                    Number__c: 1,
                    TestType__c: 'newId1',
                    [OWNER_ID]: 'ownerId',
                  },
                  {
                    Id: 'newId1',
                    Name: 'secondInstance',
                    Number__c: 1,
                    TestType__c: 'newId0',
                    [OWNER_ID]: 'ownerId',
                  },
                ],
              )
            })
          })
        })
        describe('When called with only existing instances', () => {
          beforeEach(async () => {
            mockQuery = jest.fn().mockImplementation(async () => ({
              totalSize: 2,
              done: true,
              records: [
                existingInstanceRecordValues,
                anotherExistingInstanceRecordValues,
              ],
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
              progressReporter: nullProgressReporter,
            })
          })

          it('Should query according to instance values', () => {
            expect(mockQuery.mock.calls).toHaveLength(1)
            expect(mockQuery.mock.calls[0][0]).toEqual(
              "SELECT Id,OwnerId,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN ('existingInstance','anotherExistingInstanceWithThing\\'') AND NumField IN (1,null) AND City IN ('Tel-Aviv',null) AND Country IN ('Israel',null) AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN ('first',null) AND LastName IN ('last',null) AND Salutation IN ('mrs.',null) AND MiddleName IN (null) AND Suffix IN (null)",
            )
          })

          it('Should call load operation once with update', () => {
            expect(mockBulkLoad.mock.calls.length).toBe(1)
            const updateCall = mockBulkLoad.mock.calls.find(
              (call) => call[1] === 'update',
            )
            expect(updateCall).toBeDefined()
          })

          it('Should have result with 2 applied changes, add 2 instances with insert Id and OwnerId', async () => {
            expect(result.errors).toHaveLength(0)
            expect(result.appliedChanges).toHaveLength(2)

            // existingInstance appliedChange
            const existingInstanceChangeData = result.appliedChanges
              .map(getChangeData)
              .find((element) =>
                element.elemID.isEqual(existingInstance.elemID),
              ) as InstanceElement
            expect(existingInstanceChangeData).toBeDefined()
            expect(existingInstanceChangeData.value.SaltoName).toBeDefined()
            expect(existingInstanceChangeData.value.SaltoName).toBe(
              'existingInstance',
            )
            // Should add result Id
            expect(existingInstanceChangeData.value.Id).toBeDefined()
            expect(existingInstanceChangeData.value.Id).toEqual('queryId')
            // Should add result OwnerId
            expect(existingInstanceChangeData.value.Id).toBeDefined()
            expect(existingInstanceChangeData.value[OWNER_ID]).toEqual(
              'ownerId',
            )

            // anotherExistingInstance appliedChange
            const anotherExistingInstanceChangeData = result.appliedChanges
              .map(getChangeData)
              .find((element) =>
                element.elemID.isEqual(anotherExistingInstance.elemID),
              ) as InstanceElement
            expect(anotherExistingInstanceChangeData.elemID).toEqual(
              anotherExistingInstance.elemID,
            )
            expect(
              anotherExistingInstanceChangeData.value.SaltoName,
            ).toBeDefined()
            expect(anotherExistingInstanceChangeData.value.SaltoName).toBe(
              "anotherExistingInstanceWithThing'",
            )
            // Should add result Id
            expect(anotherExistingInstanceChangeData.value.Id).toBeDefined()
            expect(anotherExistingInstanceChangeData.value.Id).toEqual(
              'anotherQueryId',
            )
            // Should add result OwnerId
            expect(anotherExistingInstanceChangeData.value.Id).toBeDefined()
            expect(anotherExistingInstanceChangeData.value[OWNER_ID]).toEqual(
              'anotherOwnerId',
            )
          })
        })
        describe('When called with a large number of new instances', () => {
          beforeEach(async () => {
            const createTestInstanceAddition = (
              idx: number,
            ): Change<InstanceElement> => ({
              action: 'add',
              data: {
                after: new InstanceElement(`test${idx}`, customObject, {
                  SaltoName: `name${idx}`,
                  NumField: idx,
                }),
              },
            })
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'add_Test_instances',
                changes: _.times(100, createTestInstanceAddition),
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should not not exceed max query size', () => {
            const queryLengths = connection.query.mock.calls.map(
              (args) => args[0].length,
            )
            expect(_.max(queryLengths)).toBeLessThanOrEqual(
              DefaultSoqlQueryLimits.maxQueryLength,
            )
          })
          it('should query all instances', () => {
            const queries = connection.query.mock.calls.map((args) => args[0])
            _.times(100).forEach((idx) => {
              expect(queries).toContainEqual(
                expect.stringMatching(
                  new RegExp(
                    `SELECT.*WHERE SaltoName IN.*'name${idx}'.*NumField IN.*${idx}(,|\\)).*`,
                  ),
                ),
              )
            })
          })
          it('should call bulk insert once', () => {
            expect(connection.bulk.load).toHaveBeenCalledTimes(1)
            expect(connection.bulk.load).toHaveBeenCalledWith(
              'Type',
              'insert',
              expect.anything(),
              expect.anything(),
            )
          })
        })
      })

      describe('When loadBulk partially succeeds', () => {
        beforeEach(async () => {
          mockQuery = jest.fn().mockImplementation(async () => ({
            totalSize: 2,
            done: true,
            records: [
              existingInstanceRecordValues,
              anotherExistingInstanceRecordValues,
            ],
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
            progressReporter: nullProgressReporter,
          })
        })
        it('Should query according to instance values', () => {
          expect(mockQuery.mock.calls).toHaveLength(1)
          expect(mockQuery.mock.calls[0][0]).toEqual(
            "SELECT Id,OwnerId,SaltoName,NumField,Address,FirstName,LastName,Salutation,MiddleName,Suffix FROM Type WHERE SaltoName IN ('existingInstance','newInstanceWithRef','anotherExistingInstanceWithThing\\'','anotherNewInstance') AND NumField IN (1,2,null,3) AND City IN ('Tel-Aviv',null,'Ashkelon') AND Country IN ('Israel',null) AND GeocodeAccuracy IN (null) AND Latitude IN (null) AND Longitude IN (null) AND PostalCode IN (null) AND State IN (null) AND Street IN (null) AND FirstName IN ('first',null) AND LastName IN ('last',null) AND Salutation IN ('mrs.',null) AND MiddleName IN (null) AND Suffix IN (null)",
          )
        })

        it('Should call load operation both with update and with insert', () => {
          expect(partialBulkLoad.mock.calls.length).toBe(2)
          const insertCall = partialBulkLoad.mock.calls.find(
            (call) => call[1] === 'insert',
          )
          expect(insertCall).toBeDefined()
          const updateCall = partialBulkLoad.mock.calls.find(
            (call) => call[1] === 'update',
          )
          expect(updateCall).toBeDefined()
        })

        it('Should have six errors (2 for update and 4 for add)', () => {
          expect(result.errors).toBeArrayOfSize(6)
          expect(result.errors).toEqual([
            expect.objectContaining({
              elemID: newInstanceWithRef.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: newInstanceWithRef.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: newInstanceWithRef.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: newInstanceWithRef.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstance.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstance.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
          ])
        })

        it('Should have three applied add change with the right ids', () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(isAdditionChange(result.appliedChanges[0])).toBeTruthy()
          const changeData = getChangeData(result.appliedChanges[0])
          expect(changeData).toBeDefined()
          expect(isInstanceElement(changeData)).toBeTruthy()
          expect(
            (changeData as InstanceElement).value[
              constants.CUSTOM_OBJECT_ID_FIELD
            ],
          ).toBe('newId1')
          expect(isAdditionChange(result.appliedChanges[1])).toBeTruthy()
          const anotherChangeData = getChangeData(result.appliedChanges[1])
          expect(anotherChangeData).toBeDefined()
          expect(isInstanceElement(anotherChangeData)).toBeTruthy()
          expect(
            (anotherChangeData as InstanceElement).value[
              constants.CUSTOM_OBJECT_ID_FIELD
            ],
          ).toBe('newId3')
          expect(isAdditionChange(result.appliedChanges[2])).toBeTruthy()
          const anotherNewChangeData = getChangeData(result.appliedChanges[2])
          expect(anotherNewChangeData).toBeDefined()
          expect(isInstanceElement(anotherNewChangeData)).toBeTruthy()
          expect(
            (anotherNewChangeData as InstanceElement).value[
              constants.CUSTOM_OBJECT_ID_FIELD
            ],
          ).toBe('anotherQueryId')
        })
      })
    })

    describe('When valid modify group', () => {
      const instanceToModify = existingInstance.clone()
      instanceToModify.value.Id = 'modifyId'
      const anotherInstanceToModify = anotherExistingInstance.clone()
      anotherInstanceToModify.value.Id = 'anotherModifyId'
      const instanceWithNonUpdateableFieldBefore =
        existingInstanceWithNonUpdateableField.clone()
      instanceWithNonUpdateableFieldBefore.value.Id = 'yetAnotherModifyId'
      const instanceWithNonUpdateableFieldAfter =
        instanceWithNonUpdateableFieldBefore.clone()
      instanceWithNonUpdateableFieldAfter.value.NotUpdateable =
        'PleaseDontUpdate'
      const modifyDeployGroup = {
        groupID: 'modify__Test__c',
        changes: [
          {
            action: 'modify',
            data: { before: instanceToModify, after: instanceToModify },
          },
          {
            action: 'modify',
            data: {
              before: anotherInstanceToModify,
              after: anotherInstanceToModify,
            },
          },
          {
            action: 'modify',
            data: {
              before: instanceWithNonUpdateableFieldBefore,
              after: instanceWithNonUpdateableFieldAfter,
            },
          },
        ],
      } as ChangeGroup
      describe('when loadBulk succeeds for all', () => {
        beforeEach(async () => {
          result = await adapter.deploy({
            changeGroup: modifyDeployGroup,
            progressReporter: nullProgressReporter,
          })
        })

        it('should return one error and 3 fitting applied changes', async () => {
          expect(result.errors).toEqual([
            expect.objectContaining({
              elemID: instanceWithNonUpdateableFieldAfter.elemID,
              message: expect.stringContaining('updateable'),
              severity: 'Warning',
            }),
          ])
        })

        it('should return correct applied changes', async () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(isModificationChange(result.appliedChanges[0])).toBeTruthy()
          const changeData = getChangeData(result.appliedChanges[0])
          expect(changeData).toBeDefined()
          expect(isInstanceElement(changeData)).toBeTruthy()
          expect(isModificationChange(result.appliedChanges[1])).toBeTruthy()
          const secondChangeData = getChangeData(result.appliedChanges[1])
          expect(secondChangeData).toBeDefined()
          expect(isInstanceElement(secondChangeData)).toBeTruthy()
          const thirdChangeData = getChangeData(result.appliedChanges[2])
          expect(thirdChangeData).toBeDefined()
          expect(isInstanceElement(thirdChangeData)).toBeTruthy()
          expect((thirdChangeData as InstanceElement).value).not.toHaveProperty(
            'NotUpdateable',
          )
        })
      })

      describe('when loadBulk partially succeeds', () => {
        beforeEach(async () => {
          connection.bulk.load = partialBulkLoad
          result = await adapter.deploy({
            changeGroup: modifyDeployGroup,
            progressReporter: nullProgressReporter,
          })
        })

        it('should return correct errors applied changes', async () => {
          expect(result.errors).toEqual([
            expect.objectContaining({
              elemID: existingInstance.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstance.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstanceWithNonUpdateableField.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstanceWithNonUpdateableField.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstanceWithNonUpdateableField.elemID,
              message: expect.stringContaining('updateable'),
              severity: 'Warning',
            }),
          ])

          expect(result.appliedChanges).toHaveLength(1)
          expect(isModificationChange(result.appliedChanges[0])).toBeTruthy()
          const changeData = getChangeData(result.appliedChanges[0])
          expect(changeData).toBeDefined()
          expect(isInstanceElement(changeData)).toBeTruthy()
        })
      })

      describe('when loadBulk fails for all', () => {
        beforeEach(async () => {
          connection.bulk.load = getBulkLoadMock('fail')
          result = await adapter.deploy({
            changeGroup: modifyDeployGroup,
            progressReporter: nullProgressReporter,
          })
        })

        it('should return only errors', async () => {
          expect(result.errors).toEqual([
            expect.objectContaining({
              elemID: existingInstance.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstance.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: anotherExistingInstance.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: anotherExistingInstance.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstanceWithNonUpdateableField.elemID,
              message: expect.stringContaining(errorMsgs[0]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstanceWithNonUpdateableField.elemID,
              message: expect.stringContaining(errorMsgs[1]),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: existingInstanceWithNonUpdateableField.elemID,
              message: expect.stringContaining('updateable'),
              severity: 'Warning',
            }),
          ])

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
          result = await adapter.deploy({
            changeGroup: removeChangeGroup,
            progressReporter: nullProgressReporter,
          })
        })

        it('should return no errors and 2 fitting applied changes', () => {
          expect(result.errors).toHaveLength(0)
          expect(result.appliedChanges).toHaveLength(2)
          expect(isRemovalChange(result.appliedChanges[0])).toBeTruthy()
          const changeData = getChangeData(result.appliedChanges[0])
          expect(changeData).toBeDefined()
          expect(isInstanceElement(changeData)).toBeTruthy()
          expect(isRemovalChange(result.appliedChanges[1])).toBeTruthy()
          const secondChangeData = getChangeData(result.appliedChanges[1])
          expect(secondChangeData).toBeDefined()
          expect(isInstanceElement(secondChangeData)).toBeTruthy()
        })
      })

      describe('when loadBulk partially succeeds', () => {
        describe('when loadBulk succeeds for all', () => {
          beforeEach(async () => {
            connection.bulk.load = partialBulkLoad
            result = await adapter.deploy({
              changeGroup: removeChangeGroup,
              progressReporter: nullProgressReporter,
            })
          })

          it('should return two error', () => {
            expect(result.errors).toEqual([
              expect.objectContaining({
                elemID: existingInstance.elemID,
                message: expect.stringContaining(errorMsgs[0]),
                severity: 'Error',
              }),
              expect.objectContaining({
                elemID: existingInstance.elemID,
                message: expect.stringContaining(errorMsgs[1]),
                severity: 'Error',
              }),
            ])
          })

          it('should return one applied change', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(isRemovalChange(result.appliedChanges[0])).toBeTruthy()
            const changeData = getChangeData(result.appliedChanges[0])
            expect(changeData).toBeDefined()
            expect(isInstanceElement(changeData)).toBeTruthy()
          })
        })

        describe('when loadBulk fails for all', () => {
          beforeEach(async () => {
            connection.bulk.load = getBulkLoadMock('fail')
            result = await adapter.deploy({
              changeGroup: removeChangeGroup,
              progressReporter: nullProgressReporter,
            })
          })

          it('should return only errors', () => {
            expect(result.errors).toEqual([
              expect.objectContaining({
                elemID: existingInstance.elemID,
                message: expect.stringContaining(errorMsgs[0]),
                severity: 'Error',
              }),
              expect.objectContaining({
                elemID: existingInstance.elemID,
                message: expect.stringContaining(errorMsgs[1]),
                severity: 'Error',
              }),
              expect.objectContaining({
                elemID: anotherExistingInstance.elemID,
                message: expect.stringContaining(errorMsgs[0]),
                severity: 'Error',
              }),
              expect.objectContaining({
                elemID: anotherExistingInstance.elemID,
                message: expect.stringContaining(errorMsgs[1]),
                severity: 'Error',
              }),
            ])
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
          }),
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
              progressReporter: nullProgressReporter,
            })
          })
        })
        describe('Modify group', () => {
          it('should fail', async () => {
            result = await adapter.deploy({
              changeGroup: {
                groupID: 'badGroup',
                changes: [
                  {
                    action: 'modify',
                    data: { before: existingInstance, after: existingInstance },
                  },
                  {
                    action: 'modify',
                    data: {
                      before: instanceOfAnotherType,
                      after: instanceOfAnotherType,
                    },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
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
              progressReporter: nullProgressReporter,
            })
          })
        })
        afterEach(() => {
          expect(result.errors).toSatisfyAll(
            (error) =>
              error.severity === 'Error' &&
              error.message.includes(
                'Custom Object Instances change group should have a single type but got: Type,anotherType',
              ) &&
              error.elemID !== undefined,
          )
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
                {
                  action: 'modify',
                  data: {
                    before: instanceToModify,
                    after: anotherInstanceToModify,
                  },
                },
              ],
            },
            progressReporter: nullProgressReporter,
          })
          expect(result.errors).toEqual([
            expect.objectContaining({
              elemID: instanceToModify.elemID,
              message: expect.stringContaining(
                'Failed to update as api name prev=modifyId and new=anotherModifyId are different',
              ),
              severity: 'Error',
            }),
          ])
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
            progressReporter: nullProgressReporter,
          })
          expect(result.errors).toSatisfyAll(
            (error) =>
              error.severity === 'Error' &&
              error.message.includes(
                'Custom Object Instances change group must have one action',
              ) &&
              error.elemID !== undefined,
          )
        })
      })
    })

    describe('when group is ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP', () => {
      describe('when no Errors occur during the deploy', () => {
        beforeEach(async () => {
          const approvalRule = new InstanceElement(
            'customApprovalRule',
            mockTypes.ApprovalRule,
            {
              [SBAA_CONDITIONS_MET]: 'Custom',
            },
          )
          const approvalCondition = new InstanceElement(
            'customApprovalCondition',
            mockTypes.ApprovalCondition,
            {
              [SBAA_APPROVAL_RULE]: new ReferenceExpression(
                approvalRule.elemID,
                approvalRule,
              ),
            },
          )
          const changeGroup = {
            groupID: ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
            changes: [approvalRule, approvalCondition].map((instance) =>
              toChange({ after: instance }),
            ),
          }
          result = await adapter.deploy({
            changeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('should deploy successfully', () => {
          expect(result.errors).toBeEmpty()
          expect(result.appliedChanges).toHaveLength(2)
          const [approvalRule, approvalCondition] = result.appliedChanges
            .map(getChangeData)
            .filter(isInstanceElement)
          expect(approvalRule.value).toEqual({
            [CUSTOM_OBJECT_ID_FIELD]: 'newId0',
            [SBAA_CONDITIONS_MET]: 'Custom',
          })
          expect(approvalCondition.value).toEqual({
            [CUSTOM_OBJECT_ID_FIELD]: 'newId0',
            [SBAA_APPROVAL_RULE]: expect.objectContaining({
              elemID: approvalRule.elemID,
            }),
          })

          expect(connection.bulk.load).toHaveBeenCalledTimes(3)
          expect(connection.bulk.load).toHaveBeenCalledWith(
            SBAA_APPROVAL_RULE,
            'insert',
            expect.anything(),
            [{ Id: undefined, [SBAA_CONDITIONS_MET]: 'All' }],
          )
          expect(connection.bulk.load).toHaveBeenCalledWith(
            SBAA_APPROVAL_CONDITION,
            'insert',
            expect.anything(),
            [
              {
                Id: undefined,
                [SBAA_APPROVAL_RULE]:
                  approvalRule.value[CUSTOM_OBJECT_ID_FIELD],
              },
            ],
          )
          expect(connection.bulk.load).toHaveBeenCalledWith(
            SBAA_APPROVAL_RULE,
            'update',
            expect.anything(),
            [{ Id: 'newId0', [SBAA_CONDITIONS_MET]: 'Custom' }],
          )
        })
      })
      describe('when some ApprovalRule instances fail to deploy', () => {
        let approvalRule: InstanceElement
        let approvalCondition: InstanceElement
        let failApprovalRule: InstanceElement
        let failApprovalCondition: InstanceElement
        beforeEach(async () => {
          approvalRule = new InstanceElement('1', mockTypes.ApprovalRule, {
            [SBAA_CONDITIONS_MET]: 'Custom',
          })
          approvalCondition = new InstanceElement(
            '1',
            mockTypes.ApprovalCondition,
            {
              [SBAA_APPROVAL_RULE]: new ReferenceExpression(
                approvalRule.elemID,
                approvalRule,
              ),
            },
          )
          failApprovalRule = new InstanceElement('2', mockTypes.ApprovalRule, {
            [SBAA_CONDITIONS_MET]: 'Custom',
            Name: 'Fail', // Used to indicate which Record should fail in SF
          })
          failApprovalCondition = new InstanceElement(
            '2',
            mockTypes.ApprovalCondition,
            {
              [SBAA_APPROVAL_RULE]: new ReferenceExpression(
                failApprovalRule.elemID,
                failApprovalRule,
              ),
            },
          )
          const changeGroup = {
            groupID: ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
            changes: [
              approvalRule,
              failApprovalRule,
              approvalCondition,
              failApprovalCondition,
            ].map((instance) => toChange({ after: instance })),
          }

          connection.bulk.load = jest
            .fn()
            .mockImplementation(
              (
                _type: string,
                _operation: BulkLoadOperation,
                _opt?: BulkOptions,
                input?: SfRecord[],
              ) => {
                const loadEmitter = new EventEmitter()
                loadEmitter.on('newListener', (_event, _listener) => {
                  // This is a workaround to call emit('close')
                  // that is really called as a side effect to load() inside
                  // jsforce *after* our code listens on.('close')
                  setTimeout(() => loadEmitter.emit('close'), 0)
                })
                return {
                  then: () =>
                    Promise.resolve(
                      input?.map((res, index) => ({
                        id: res.Id || `newId${index}`,
                        success: res.Name !== 'Fail',
                        errors:
                          res.Name === 'Fail'
                            ? ['Failed to deploy ApprovalRule with Name Fail']
                            : [],
                      })),
                    ),
                  job: loadEmitter,
                }
              },
            )

          result = await adapter.deploy({
            changeGroup,
            progressReporter: nullProgressReporter,
          })
        })

        it('should deploy partially', () => {
          expect(result.errors).toEqual([
            expect.objectContaining({ elemID: failApprovalRule.elemID }),
            expect.objectContaining({ elemID: failApprovalCondition.elemID }),
          ])
          expect(result.appliedChanges).toHaveLength(2)
          const [appliedApprovalRule, appliedApprovalCondition] =
            result.appliedChanges.map(getChangeData).filter(isInstanceElement)
          expect(appliedApprovalRule.elemID).toEqual(approvalRule.elemID)
          expect(appliedApprovalCondition.elemID).toEqual(
            approvalCondition.elemID,
          )
        })
      })
      describe('when an ApprovalRule instance does not have sbaa__ConditionsMet__c = Custom', () => {
        let changeGroup: ChangeGroup
        beforeEach(() => {
          const approvalRule = new InstanceElement(
            '1',
            mockTypes.ApprovalRule,
            {
              [SBAA_CONDITIONS_MET]: 'All',
            },
          )
          const approvalCondition = new InstanceElement(
            '1',
            mockTypes.ApprovalCondition,
            {
              [SBAA_APPROVAL_RULE]: new ReferenceExpression(
                approvalRule.elemID,
                approvalRule,
              ),
            },
          )
          changeGroup = {
            groupID: ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
            changes: [approvalRule, approvalCondition].map((instance) =>
              toChange({ after: instance }),
            ),
          }
        })
        it('should throw an error', async () => {
          await expect(
            adapter.deploy({
              changeGroup,
              progressReporter: nullProgressReporter,
            }),
          ).rejects.toThrow()
        })
      })
    })

    describe('when group is ADD_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP', () => {
      let mockQuery: jest.Mock
      beforeEach(() => {
        mockQuery = jest
          .fn()
          .mockImplementationOnce(() => ({
            // first insert of PriceRule with ConditionsMet='All'
            totalSize: 0,
            done: true,
            records: [],
          }))
          .mockImplementationOnce(() => ({
            // insert of PriceCondition
            totalSize: 0,
            done: true,
            records: [],
          }))
          .mockImplementationOnce(() => ({
            // second insert of PriceRule with ConditionsMet='Custom'
            totalSize: 1,
            done: true,
            records: [
              {
                Id: 'newId0',
                OwnerId: 'SomeOwnerId',
              },
            ],
          }))
        connection.query = mockQuery
      })
      describe('when no Errors occur during the deploy', () => {
        beforeEach(async () => {
          const priceRule = new InstanceElement(
            'somePriceRule',
            mockTypes[CPQ_PRICE_RULE],
            {
              [CPQ_CONDITIONS_MET]: 'Custom',
            },
          )
          const priceCondition = new InstanceElement(
            'somePriceCondition',
            mockTypes[CPQ_PRICE_CONDITION],
            {
              [CPQ_PRICE_CONDITION_RULE_FIELD]: new ReferenceExpression(
                priceRule.elemID,
                priceRule,
              ),
            },
          )
          const changeGroup = {
            groupID: ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
            changes: [priceRule, priceCondition].map((instance) =>
              toChange({ after: instance }),
            ),
          }
          result = await adapter.deploy({
            changeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('should deploy successfully', () => {
          expect(result.errors).toBeEmpty()
          expect(result.appliedChanges).toHaveLength(2)
          const [appliedPriceRule, appliedPriceCondition] =
            result.appliedChanges.map(getChangeData).filter(isInstanceElement)
          expect(appliedPriceRule.value).toEqual({
            [CUSTOM_OBJECT_ID_FIELD]: 'newId0',
            [CPQ_CONDITIONS_MET]: 'Custom',
            [OWNER_ID]: 'SomeOwnerId',
          })
          expect(appliedPriceCondition.value).toEqual({
            [CUSTOM_OBJECT_ID_FIELD]: 'newId0',
            [CPQ_PRICE_CONDITION_RULE_FIELD]: expect.objectContaining({
              elemID: appliedPriceRule.elemID,
            }),
          })

          expect(connection.bulk.load).toHaveBeenCalledTimes(3)
          expect(connection.bulk.load).toHaveBeenCalledWith(
            CPQ_PRICE_RULE,
            'insert',
            expect.anything(),
            [{ Id: undefined, [CPQ_CONDITIONS_MET]: 'All' }],
          )
          expect(connection.bulk.load).toHaveBeenCalledWith(
            CPQ_PRICE_CONDITION,
            'insert',
            expect.anything(),
            [
              {
                Id: undefined,
                [CPQ_PRICE_CONDITION_RULE_FIELD]:
                  appliedPriceRule.value[CUSTOM_OBJECT_ID_FIELD],
              },
            ],
          )
          expect(connection.bulk.load).toHaveBeenCalledWith(
            CPQ_PRICE_RULE,
            'update',
            expect.anything(),
            [
              {
                Id: 'newId0',
                [OWNER_ID]: 'SomeOwnerId',
                [CPQ_CONDITIONS_MET]: 'Custom',
                Name: null,
              },
            ],
          )
        })
      })
      describe('when some PriceRule instances fail to deploy', () => {
        let priceRule: InstanceElement
        let priceCondition: InstanceElement
        let failPriceRule: InstanceElement
        let failPriceCondition: InstanceElement
        beforeEach(async () => {
          priceRule = new InstanceElement('1', mockTypes[CPQ_PRICE_RULE], {
            [CPQ_CONDITIONS_MET]: 'Custom',
          })
          priceCondition = new InstanceElement(
            '1',
            mockTypes[CPQ_PRICE_CONDITION],
            {
              [CPQ_PRICE_CONDITION_RULE_FIELD]: new ReferenceExpression(
                priceRule.elemID,
                priceRule,
              ),
            },
          )
          failPriceRule = new InstanceElement('2', mockTypes[CPQ_PRICE_RULE], {
            [CPQ_CONDITIONS_MET]: 'Custom',
            Name: 'Fail', // Used to indicate which Record should fail in SF
          })
          failPriceCondition = new InstanceElement(
            '2',
            mockTypes[CPQ_PRICE_CONDITION],
            {
              [CPQ_PRICE_CONDITION_RULE_FIELD]: new ReferenceExpression(
                failPriceRule.elemID,
                failPriceRule,
              ),
            },
          )
          const changeGroup = {
            groupID: ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
            changes: [
              priceRule,
              failPriceRule,
              priceCondition,
              failPriceCondition,
            ].map((instance) => toChange({ after: instance })),
          }

          connection.bulk.load = jest
            .fn()
            .mockImplementation(
              (
                _type: string,
                _operation: BulkLoadOperation,
                _opt?: BulkOptions,
                input?: SfRecord[],
              ) => {
                const loadEmitter = new EventEmitter()
                loadEmitter.on('newListener', (_event, _listener) => {
                  // This is a workaround to call emit('close')
                  // that is really called as a side effect to load() inside
                  // jsforce *after* our code listens on.('close')
                  setTimeout(() => loadEmitter.emit('close'), 0)
                })
                return {
                  then: () =>
                    Promise.resolve(
                      input?.map((res, index) => ({
                        id: res.Id || `newId${index}`,
                        success: res.Name !== 'Fail',
                        errors:
                          res.Name === 'Fail'
                            ? ['Failed to deploy ApprovalRule with Name Fail']
                            : [],
                      })),
                    ),
                  job: loadEmitter,
                }
              },
            )

          result = await adapter.deploy({
            changeGroup,
            progressReporter: nullProgressReporter,
          })
        })

        it('should deploy partially', () => {
          expect(result.errors).toEqual([
            expect.objectContaining({ elemID: failPriceRule.elemID }),
            expect.objectContaining({ elemID: failPriceCondition.elemID }),
          ])
          expect(result.appliedChanges).toHaveLength(2)
          const [appliedPriceRule, appliedPriceCondition] =
            result.appliedChanges.map(getChangeData).filter(isInstanceElement)
          expect(appliedPriceRule.elemID).toEqual(priceRule.elemID)
          expect(appliedPriceCondition.elemID).toEqual(priceCondition.elemID)
        })
      })
      describe('when a PriceRule instance does not have SBQQ__ConditionsMet__c = Custom', () => {
        let changeGroup: ChangeGroup
        beforeEach(() => {
          const priceRule = new InstanceElement(
            '1',
            mockTypes[CPQ_PRICE_RULE],
            {
              [CPQ_CONDITIONS_MET]: 'All',
            },
          )
          const priceCondition = new InstanceElement(
            '1',
            mockTypes[CPQ_PRICE_CONDITION],
            {
              [CPQ_PRICE_CONDITION_RULE_FIELD]: new ReferenceExpression(
                priceRule.elemID,
                priceRule,
              ),
            },
          )
          changeGroup = {
            groupID: ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
            changes: [priceRule, priceCondition].map((instance) =>
              toChange({ after: instance }),
            ),
          }
        })
        it('should throw an error', async () => {
          await expect(
            adapter.deploy({
              changeGroup,
              progressReporter: nullProgressReporter,
            }),
          ).rejects.toThrow()
        })
      })
    })
  })

  describe('When adapter is defined with dataManagement config with invalid fields in SaltoIDSettings', () => {
    beforeEach(() => {
      ;({ adapter } = mockAdapter({
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
          changes: [{ action: 'add', data: { after: existingInstance } }],
        },
        progressReporter: nullProgressReporter,
      })
      expect(result.errors).toEqual([
        expect.objectContaining({
          severity: 'Error',
          message: expect.stringContaining(
            'Failed to add instances of type Type due to invalid SaltoIdFields - NonExistingFields',
          ),
        }),
      ])
    })
  })

  describe('When adapter is defined without dataManagement config', () => {
    beforeEach(() => {
      ;({ adapter } = mockAdapter({
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
            changes: [{ action: 'add', data: { after: existingInstance } }],
          },
          progressReporter: nullProgressReporter,
        })
      })
    })

    describe('Modify deploy group', () => {
      it('should fail', async () => {
        result = await adapter.deploy({
          changeGroup: {
            groupID: 'modify_Test_instances',
            changes: [
              {
                action: 'modify',
                data: { before: existingInstance, after: existingInstance },
              },
            ],
          },
          progressReporter: nullProgressReporter,
        })
      })
    })

    describe('Remove deploy group', () => {
      it('should fail', async () => {
        result = await adapter.deploy({
          changeGroup: {
            groupID: 'remove_Test_instances',
            changes: [{ action: 'remove', data: { before: existingInstance } }],
          },
          progressReporter: nullProgressReporter,
        })
      })
    })

    afterEach(() => {
      expect(result.errors).toEqual([
        expect.objectContaining({
          severity: 'Error',
          message: expect.stringContaining(
            'dataManagement must be defined in the salesforce.nacl config to deploy Custom Object instances',
          ),
        }),
      ])
    })
  })
})
