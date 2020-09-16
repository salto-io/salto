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
  ChangeError, ElemID, Field, ObjectType, toChange, TypeElement,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import customFieldTypeValidator from '../../src/change_validators/custom_field_type'
import { API_NAME, CUSTOM_OBJECT } from '../../src/constants'

describe('custom field type change validator', () => {
  describe('onUpdate', () => {
    let customObj: ObjectType
    beforeEach(() => {
      customObj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
        annotations: { metadataType: CUSTOM_OBJECT },
      })
    })

    const createCustomField = (fieldType: TypeElement, fieldApiName: string): Field => {
      const newField = new Field(customObj, 'field', fieldType, {
        [API_NAME]: fieldApiName,
      })
      customObj.fields.field = newField
      return newField
    }

    const runChangeValidator = (before: Field | undefined, after: Field):
        Promise<ReadonlyArray<ChangeError>> =>
      customFieldTypeValidator([toChange({ before, after })])

    it('should have error for custom field type change to an invalid field type', async () => {
      const beforeField = createCustomField(Types.primitiveDataTypes.Time, 'Something')
      const afterField = createCustomField(Types.compoundDataTypes.Address, 'Something')
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have error for field creation with invalid field type', async () => {
      const field = createCustomField(Types.compoundDataTypes.Address, 'Something')
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(field.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have no error when changing a field type to a valid type', async () => {
      const beforeField = createCustomField(Types.primitiveDataTypes.Text, 'Something')
      const afterField = createCustomField(Types.primitiveDataTypes.Time, 'Somthing')
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error when creating a field with a valid field type', async () => {
      const field = createCustomField(Types.primitiveDataTypes.Checkbox, 'Something')
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await customFieldTypeValidator([
        toChange({ before: customObj, after: customObj.clone() }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
