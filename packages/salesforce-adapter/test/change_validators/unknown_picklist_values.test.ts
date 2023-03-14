/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeError, CORE_ANNOTATIONS, ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import changeValidator from '../../src/change_validators/unknown_picklist_values'
import { FIELD_ANNOTATIONS, INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { createCustomObjectType } from '../utils'


describe('unknownPicklistValues ChangeValidator', () => {
  const TEST_OBJECT_NAME = 'TestObject__c'
  const ELEMENTS_SOURCE = buildElementsSourceFromElements([])

  let changeErrors: readonly ChangeError[]

  const createInstanceWithPicklistValues = (...values: string[]): InstanceElement => (
    new InstanceElement(
      'testInstance',
      createCustomObjectType(TEST_OBJECT_NAME, {
        elemID: new ElemID(SALESFORCE, TEST_OBJECT_NAME),
        fields: Object.fromEntries(values.map((_value, i) => [
          `field${i}__c`,
          {
            refType: Types.primitiveDataTypes.Picklist,
            annotations: {
              [FIELD_ANNOTATIONS.VALUE_SET]: [
                { [INSTANCE_FULL_NAME_FIELD]: 'knownValue1' },
                { [INSTANCE_FULL_NAME_FIELD]: 'knownValue2' },
                { [INSTANCE_FULL_NAME_FIELD]: 'knownValue3' },
              ],
              [CORE_ANNOTATIONS.RESTRICTION]: {
                values: ['knownValue1', 'knownValue2', 'knownValue3'],
                enforceValue: true,
              },
            },
          },
        ])),
      }),
      Object.fromEntries(values.map((value, i) => [`field${i}__c`, value]))
    )
  )
  describe('when instances have unknown picklist values', () => {
    const UNKNOWN_VALUES = ['unknownValue1', 'unknownValue2', 'unknownValue1']
    beforeEach(async () => {
      const instance = createInstanceWithPicklistValues('knownValue1', 'knownValue2', ...UNKNOWN_VALUES)
      changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
    })
    it('should create errors', () => {
      expect(changeErrors).toHaveLength(UNKNOWN_VALUES.length)
    })
  })

  describe('when instances dont have unknown picklist values', () => {
    beforeEach(async () => {
      const instance = createInstanceWithPicklistValues('knownValue1', 'knownValue2', 'knownValue3', 'knownValue1')
      changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
    })
    it('should not create errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })

  describe('whn picklist field has no restriction annotation', () => {
    beforeEach(async () => {
      const instance = createInstanceWithPicklistValues('value', 'anotherValue')
      const instanceType = await instance.getType()
      Object.values(instanceType.fields).forEach(field => {
        delete field.annotations[CORE_ANNOTATIONS.RESTRICTION]
      })
      changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
    })
    it('should not create errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
