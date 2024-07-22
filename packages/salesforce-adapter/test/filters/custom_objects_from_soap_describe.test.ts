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
import { ObjectType, Element, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { MockInterface } from '@salto-io/test-utils'
import { DescribeSObjectResult } from '@salto-io/jsforce'
import Connection from '../../src/client/jsforce'
import {
  FIELD_ANNOTATIONS,
  FILTER_ITEM_FIELDS,
  CUSTOM_OBJECT,
  INSTANCE_FULL_NAME_FIELD,
  LABEL,
  LOOKUP_FILTER_FIELDS,
  FIELD_DEPENDENCY_FIELDS,
  VALUE_SETTINGS_FIELDS,
  VALUE_SET_FIELDS,
  CUSTOM_VALUE,
  VALUE_SET_DEFINITION_FIELDS,
} from '../../src/constants'
import mockAdapter from '../adapter'
import { findElements, defaultFilterContext } from '../utils'
import filterCreator from '../../src/filters/custom_objects_from_soap_describe'
import {
  INSTANCE_TYPE_FIELD,
  INSTANCE_REQUIRED_FIELD,
} from '../../src/filters/custom_objects_to_object_type'
import { generateCustomObjectType } from './custom_objects_to_object_type.test'
import {
  mockSObjectDescribeGlobal,
  mockSObjectDescribe,
  mockFileProperties,
} from '../connection'
import { FilterWith } from './mocks'

describe('Custom Objects from describe filter', () => {
  let connection: MockInterface<Connection>
  let customObjectType: ObjectType
  let testInstanceElement: InstanceElement
  let filter: FilterWith<'onFetch'>

  beforeEach(() => {
    customObjectType = generateCustomObjectType()
    testInstanceElement = new InstanceElement('Lead', customObjectType, {
      fields: [
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyAutoNumber',
          [INSTANCE_TYPE_FIELD]: 'AutoNumber',
          [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'A-{0000}',
          [INSTANCE_REQUIRED_FIELD]: 'false',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'UnsupportedField',
          [INSTANCE_TYPE_FIELD]: 'DateTime',
          [INSTANCE_REQUIRED_FIELD]: 'false',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'FieldWithNoType',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyPicklist',
          [INSTANCE_TYPE_FIELD]: 'Picklist',
          [INSTANCE_REQUIRED_FIELD]: 'true',
          [FIELD_ANNOTATIONS.DEFAULT_VALUE]: 'YES',
          [FIELD_ANNOTATIONS.VALUE_SET]: {
            [VALUE_SET_FIELDS.RESTRICTED]: 'true',
            [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
              [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'YES',
                  [CUSTOM_VALUE.LABEL]: 'YES',
                  [CUSTOM_VALUE.DEFAULT]: 'true',
                },
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'NO',
                  [CUSTOM_VALUE.LABEL]: 'NO',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.IS_ACTIVE]: 'true',
                  [CUSTOM_VALUE.COLOR]: '#FF0000',
                },
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'MAYBE',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.LABEL]: 'MAYBE',
                  [CUSTOM_VALUE.IS_ACTIVE]: 'false',
                },
              ],
            },
          },
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyCheckbox',
          [INSTANCE_TYPE_FIELD]: 'Checkbox',
          [INSTANCE_REQUIRED_FIELD]: 'false',
          [FIELD_ANNOTATIONS.DEFAULT_VALUE]: 'true',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'rollup',
          [LABEL]: 'My Summary',
          [FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: 'Opportunity.Amount',
          [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: {
            [FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.Amount',
            [FILTER_ITEM_FIELDS.OPERATION]: 'greaterThan',
            [FILTER_ITEM_FIELDS.VALUE]: '1',
          },
          [FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: 'Opportunity.AccountId',
          [FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'sum',
          [INSTANCE_TYPE_FIELD]: 'Summary',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'lookup_field',
          [LABEL]: 'My Lookup',
          [FIELD_ANNOTATIONS.REFERENCE_TO]: 'Account',
          [FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
            [LOOKUP_FILTER_FIELDS.ACTIVE]: 'true',
            [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: 'myBooleanFilter',
            [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'myErrorMessage',
            [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'myInfoMessage',
            [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: 'false',
            [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: {
              [FILTER_ITEM_FIELDS.FIELD]: 'myField1',
              [FILTER_ITEM_FIELDS.OPERATION]: 'myOperation1',
              [FILTER_ITEM_FIELDS.VALUE_FIELD]: 'myValueField1',
            },
          },
          [INSTANCE_TYPE_FIELD]: 'Lookup',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'lookup_field_optional',
          [LABEL]: 'My Lookup',
          [FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
            [LOOKUP_FILTER_FIELDS.ACTIVE]: 'true',
            [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'myErrorMessage',
            [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: 'true',
          },
          [INSTANCE_TYPE_FIELD]: 'Lookup',
        },
        {
          [INSTANCE_FULL_NAME_FIELD]: 'picklist_field',
          [LABEL]: 'My Field Dependency',
          [FIELD_ANNOTATIONS.VALUE_SET]: {
            [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'ControllingFieldName',
            [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
              {
                [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: [
                  'Controlling1',
                  'Controlling2',
                ],
                [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val1',
              },
              {
                [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: [
                  'Controlling1',
                ],
                [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val2',
              },
            ],
            [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
              [VALUE_SET_DEFINITION_FIELDS.SORTED]: false,
              [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'Val1',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.LABEL]: 'Val1',
                },
                {
                  [CUSTOM_VALUE.FULL_NAME]: 'Val2',
                  [CUSTOM_VALUE.DEFAULT]: 'false',
                  [CUSTOM_VALUE.LABEL]: 'Val2',
                },
              ],
            },
          },
          [INSTANCE_TYPE_FIELD]: 'Picklist',
        },
      ],
      [INSTANCE_FULL_NAME_FIELD]: 'Lead',
    })
    const adapter = mockAdapter({})
    connection = adapter.connection
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        systemFields: ['SystemField', 'NameSystemField'],
      },
      client: adapter.client,
    }) as typeof filter
  })

  describe('onFetch', () => {
    type MockSingleSObjectProperties = Parameters<
      typeof mockSObjectDescribeGlobal
    >[0] &
      Parameters<typeof mockSObjectDescribe>[0] &
      Pick<DescribeSObjectResult, 'name'>
    const mockSingleSObject = (
      properties: MockSingleSObjectProperties,
      isMetadataType = false,
      isInCustomObjectList = true,
    ): void => {
      connection.describeGlobal.mockResolvedValue({
        sobjects: [mockSObjectDescribeGlobal(properties)],
      })
      connection.soap.describeSObjects.mockResolvedValue(
        mockSObjectDescribe(properties),
      )

      connection.metadata.describe.mockResolvedValue({
        metadataObjects: [
          CUSTOM_OBJECT,
          ...(isMetadataType ? [properties.name] : []),
        ].map((xmlName) => ({ xmlName })),
        organizationNamespace: '',
      })
      connection.metadata.list.mockImplementation(async (query) => {
        const { type } = collections.array.makeArray(query)[0]
        return type === CUSTOM_OBJECT && isInCustomObjectList
          ? [mockFileProperties({ fullName: properties.name, type })]
          : []
      })
    }

    describe('when object exists in soap API but not in metadata', () => {
      it('should not create an instance for that type', async () => {
        mockSingleSObject({ name: 'Lead' })
        const elements = [customObjectType]
        await filter.onFetch(elements)
        expect(findElements(elements, 'Lead')).toHaveLength(0)
      })
    })

    describe('when object exists in metadata API but not in soap', () => {
      let elements: Element[]
      beforeEach(async () => {
        const leadInstanceWithCustomFields = testInstanceElement.clone()
        elements = [customObjectType, leadInstanceWithCustomFields]
        await filter.onFetch(elements)
      })
      it('should leave the instance unchanged', () => {
        const leadInstances = elements.filter((o) => o.elemID.name === 'Lead')
        expect(leadInstances).toHaveLength(1)
        const [leadInstance] = leadInstances
        expect(leadInstance).toEqual(testInstanceElement)
      })
    })

    describe('when object exists in both metadata API and soap', () => {
      describe('when soap has extra information about the object', () => {
        beforeEach(async () => {
          mockSingleSObject({
            name: 'Lead',
            label: 'A Lead',
          })
          const elements = [customObjectType, testInstanceElement]
          await filter.onFetch(elements)
        })
        it('should add additional information to the instance', () => {
          expect(testInstanceElement.value).toHaveProperty('label', 'A Lead')
        })
      })

      describe('when soap as additional information about fields', () => {
        beforeEach(async () => {
          mockSingleSObject({
            name: 'Lead',
            fields: [
              {
                name: 'FieldWithNoType',
                type: 'currency',
                label: 'a label',
              },
            ],
          })
          const elements = [customObjectType, testInstanceElement]
          await filter.onFetch(elements)
        })
        it('should keep the values from the metadata API when they exist', () => {
          expect(testInstanceElement.value.fields).toContainEqual(
            testInstanceElement.value.fields[0],
          )
        })
        it('should add information to existing fields', () => {
          const expectedField = {
            [INSTANCE_FULL_NAME_FIELD]: 'FieldWithNoType',
            [INSTANCE_TYPE_FIELD]: 'Currency',
            label: 'a label',
          }
          expect(testInstanceElement.value.fields).toContainEqual(
            expect.objectContaining(expectedField),
          )
        })
      })
      describe('when soap has additional fields', () => {
        beforeEach(async () => {
          mockSingleSObject({
            name: 'Lead',
            fields: [
              {
                name: 'SObjectOnlyField__c',
                type: 'string',
                custom: true,
                createable: true,
                updateable: false,
                nillable: true,
                label: 'OnlyField',
              },
            ],
          })
          const elements = [customObjectType, testInstanceElement]
          await filter.onFetch(elements)
        })
        it('should add fields that exist only in the soap API', () => {
          const expectedField = {
            [INSTANCE_FULL_NAME_FIELD]: 'SObjectOnlyField__c',
            [INSTANCE_TYPE_FIELD]: 'Text',
            [FIELD_ANNOTATIONS.CREATABLE]: true,
            [FIELD_ANNOTATIONS.UPDATEABLE]: false,
            required: false,
            label: 'OnlyField',
          }
          expect(testInstanceElement.value.fields).toContainEqual(
            expect.objectContaining(expectedField),
          )
        })
      })

      describe('when soap has compound fields', () => {
        beforeEach(async () => {
          mockSingleSObject({
            name: 'Lead',
            fields: [
              {
                name: 'Address',
                type: 'address',
                label: 'Home Address',
                nillable: false,
              },
              {
                name: 'City',
                type: 'string',
                compoundFieldName: 'Address',
              },
              {
                name: 'Street',
                type: 'textarea',
                compoundFieldName: 'Address',
              },
            ],
          })
          const elements = [customObjectType, testInstanceElement]
          await filter.onFetch(elements)
        })
        it('should not add the nested fields that compose the compound field', () => {
          expect(testInstanceElement.value.fields).not.toContainEqual(
            expect.objectContaining({ [INSTANCE_FULL_NAME_FIELD]: 'City' }),
          )
          expect(testInstanceElement.value.fields).not.toContainEqual(
            expect.objectContaining({ [INSTANCE_FULL_NAME_FIELD]: 'Street' }),
          )
          const expectedField = {
            [INSTANCE_FULL_NAME_FIELD]: 'Address',
            [INSTANCE_TYPE_FIELD]: 'Address',
            required: true,
            label: 'Home Address',
          }
          expect(testInstanceElement.value.fields).toContainEqual(
            expect.objectContaining(expectedField),
          )
        })
      })

      describe('when instance has name compound field', () => {
        describe('when instance has salutation', () => {
          beforeEach(async () => {
            mockSingleSObject({
              name: 'Lead',
              fields: [
                {
                  name: 'Name',
                  type: 'string',
                  label: 'Full Name',
                  nameField: true,
                },
                {
                  name: 'LastName',
                  type: 'string',
                  label: 'Last Name',
                  compoundFieldName: 'Name',
                },
                {
                  name: 'FirstName',
                  type: 'string',
                  label: 'First Name',
                  compoundFieldName: 'Name',
                },
                {
                  name: 'Salutation',
                  type: 'string',
                  label: 'Salutation',
                  compoundFieldName: 'Name',
                },
              ],
            })
            const elements = [customObjectType, testInstanceElement]
            await filter.onFetch(elements)
          })
          it('should give the name field a type of Name', () => {
            const expectedField = {
              [INSTANCE_FULL_NAME_FIELD]: 'Name',
              [INSTANCE_TYPE_FIELD]: 'Name',
            }
            expect(testInstanceElement.value.fields).toContainEqual(
              expect.objectContaining(expectedField),
            )
          })
        })
        describe('when instance does not have salutation', () => {
          beforeEach(async () => {
            mockSingleSObject({
              name: 'Lead',
              fields: [
                {
                  name: 'Name',
                  type: 'string',
                  label: 'Full Name',
                  nameField: true,
                },
                {
                  name: 'LastName',
                  type: 'string',
                  label: 'Last Name',
                  compoundFieldName: 'Name',
                },
                {
                  name: 'FirstName',
                  type: 'string',
                  label: 'First Name',
                  compoundFieldName: 'Name',
                },
              ],
            })
            const elements = [customObjectType, testInstanceElement]
            await filter.onFetch(elements)
          })
          it('should give the name field a type of Name2', () => {
            const expectedField = {
              [INSTANCE_FULL_NAME_FIELD]: 'Name',
              [INSTANCE_TYPE_FIELD]: 'Name2',
            }
            expect(testInstanceElement.value.fields).toContainEqual(
              expect.objectContaining(expectedField),
            )
          })
        })
        describe('when instance has field with the same compoundFieldName', () => {
          beforeEach(async () => {
            mockSingleSObject({
              name: 'Lead',
              fields: [
                {
                  name: 'Name',
                  type: 'string',
                  label: 'Account Name',
                  nameField: true,
                  compoundFieldName: 'Name',
                },
              ],
            })
            const elements = [customObjectType, testInstanceElement]
            await filter.onFetch(elements)
          })
          it('should give the name field a type of Text', () => {
            const expectedField = {
              [INSTANCE_FULL_NAME_FIELD]: 'Name',
              [INSTANCE_TYPE_FIELD]: 'Text',
            }
            expect(testInstanceElement.value.fields).toContainEqual(
              expect.objectContaining(expectedField),
            )
          })
        })
      })
    })
  })
})
