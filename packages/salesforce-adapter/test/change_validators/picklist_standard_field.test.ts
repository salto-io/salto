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
import {
  ChangeError,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import picklistStandardFieldValidator from '../../src/change_validators/picklist_standard_field'
import { STANDARD_VALUE_SET } from '../../src/filters/standard_value_sets'
import { SALESFORCE, VALUE_SET_FIELDS } from '../../src/constants'
import { createField } from '../utils'

describe('picklist standard field change validator', () => {
  describe('onUpdate', () => {
    let obj: ObjectType
    const valueSetNameField = VALUE_SET_FIELDS.VALUE_SET_NAME
    beforeEach(() => {
      obj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
      })
    })

    const createAfterField = (beforeField: Field): Field => {
      const afterField = beforeField.clone()
      afterField.annotations.modifyMe = 'modified'
      return afterField
    }

    const createValueSetInstance = (metadataTypeVal: string): InstanceElement =>
      new InstanceElement(
        'standard_value_set_test123',
        new ObjectType({
          elemID: new ElemID(SALESFORCE, 'standard_value_set'),
          annotations: { metadataType: metadataTypeVal },
        }),
      )

    const runChangeValidatorOnUpdate = (
      before: Field,
      after: Field,
    ): Promise<ReadonlyArray<ChangeError>> =>
      picklistStandardFieldValidator([toChange({ before, after })])

    it('should have error for picklist standard field without API_NAME_SEPARATOR', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        'Standard',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have error for picklist standard field with API_NAME_SEPARATOR', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        'Obj.Standard',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(1)
    })

    it('should have error for multi picklist standard field', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.MultiselectPicklist,
        'Standard',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(1)
    })

    it('should have error for GlobalValueSet picklist standard field', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        'Standard',
      )
      beforeField.annotations[valueSetNameField] = 'valueSet'
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(1)
    })

    it('should have error for StandardValueSet picklist that points to non-standard value-set', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        'Standard',
      )
      const dummyElemID = new ElemID(SALESFORCE, 'something')
      const notStandardValueSetInstanceElement =
        createValueSetInstance('notStandardVS')
      beforeField.annotations[valueSetNameField] = new ReferenceExpression(
        dummyElemID,
        notStandardValueSetInstanceElement,
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(1)
    })

    it('should have no error for StandardValueSet picklist standard field', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        'Standard',
      )
      const dummyElemID = new ElemID(SALESFORCE, 'something')
      const standardValueSetInstanceElement =
        createValueSetInstance(STANDARD_VALUE_SET)
      beforeField.annotations[valueSetNameField] = new ReferenceExpression(
        dummyElemID,
        standardValueSetInstanceElement,
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have error for picklist custom field', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        'Custom__c',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for non-picklist standard field', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Text,
        'Standard',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(
        beforeField,
        afterField,
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await picklistStandardFieldValidator([
        toChange({ before: obj, after: obj.clone() }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
