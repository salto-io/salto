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
import {
  ChangeError, ElemID, Field, ObjectType, PrimitiveType, ReferenceExpression,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import picklistStandardFieldValidator from '../../src/change_validators/picklist_standard_field'
import {
  API_NAME, FIELD_ANNOTATIONS, SALESFORCE, VALUE_SET_FIELDS,
} from '../../src/constants'


describe('picklist standard field change validator', () => {
  describe('onUpdate', () => {
    let obj: ObjectType
    beforeEach(() => {
      obj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
      })
    })

    const createField = (fieldType: PrimitiveType, fieldApiName: string): Field => {
      const newField = new Field(obj, 'field', fieldType, {
        [API_NAME]: fieldApiName,
        modifyMe: 'modifyMe',
      })
      obj.fields.field = newField
      return newField
    }

    const createAfterField = (beforeField: Field): Field => {
      const afterField = beforeField.clone()
      afterField.annotations.modifyMe = 'modified'
      return afterField
    }

    const runChangeValidatorOnUpdate = (beforeField: Field, afterField: Field):
      Promise<ReadonlyArray<ChangeError>> =>
      picklistStandardFieldValidator.onUpdate([{
        action: 'modify',
        data: { before: beforeField, after: afterField },
      }])

    it('should have error for picklist standard field without API_NAME_SEPARATOR', async () => {
      const beforeField = createField(Types.primitiveDataTypes.Picklist, 'Standard')
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have error for picklist standard field with API_NAME_SEPARATOR', async () => {
      const beforeField = createField(Types.primitiveDataTypes.Picklist, 'Obj.Standard')
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
    })

    it('should have error for multi picklist standard field', async () => {
      const beforeField = createField(Types.primitiveDataTypes.MultiselectPicklist, 'Standard')
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
    })

    it('should have error for GlobalValueSet picklist standard field', async () => {
      const beforeField = createField(Types.primitiveDataTypes.Picklist, 'Standard')
      beforeField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = 'valueSet'
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
    })

    it('should have no error for StandardValueSet picklist standard field', async () => {
      const beforeField = createField(Types.primitiveDataTypes.Picklist, 'Standard')
      const dummyElemID = new ElemID(SALESFORCE, 'referenced')
      beforeField.annotations[FIELD_ANNOTATIONS.VALUE_SET] = new ReferenceExpression(dummyElemID)
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have error for picklist custom field', async () => {
      const beforeField = createField(Types.primitiveDataTypes.Picklist, 'Custom__c')
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have error for non-picklist standard field', async () => {
      const beforeField = createField(Types.primitiveDataTypes.Text, 'Standard')
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await picklistStandardFieldValidator.onUpdate([{
        action: 'modify',
        data: { before: obj, after: obj.clone() },
      }])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
