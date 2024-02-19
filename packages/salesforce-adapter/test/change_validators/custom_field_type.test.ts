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
  Field,
  ObjectType,
  toChange,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import customFieldTypeValidator from '../../src/change_validators/custom_field_type'
import { CUSTOM_OBJECT_ID_FIELD } from '../../src/constants'
import { createField, createCustomObjectType } from '../utils'

describe('custom field type change validator', () => {
  describe('onUpdate', () => {
    let customObj: ObjectType
    beforeEach(() => {
      customObj = createCustomObjectType('obj__c', {})
    })

    const runChangeValidator = (
      before: Field | undefined,
      after: Field,
    ): Promise<ReadonlyArray<ChangeError>> =>
      customFieldTypeValidator([toChange({ before, after })])

    it('should have error for custom field type change to an invalid field type', async () => {
      const beforeField = createField(
        customObj,
        Types.primitiveDataTypes.Time,
        'Something',
      )
      const afterField = createField(
        customObj,
        Types.compoundDataTypes.Name,
        'Something',
      )
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Warning')
    })

    it('should have error for field creation with invalid field type', async () => {
      const field = createField(
        customObj,
        Types.compoundDataTypes.Name,
        'Something',
      )
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(field.elemID)
      expect(changeError.severity).toEqual('Warning')
    })

    it('should have no error when changing a field but not its type', async () => {
      const beforeField = createField(
        customObj,
        Types.compoundDataTypes.Name,
        'Something',
      )
      const afterField = beforeField.clone()
      afterField.annotate({ testAnnotation: 'testAnnotationValue' })
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error when changing a field type to a valid type', async () => {
      const beforeField = createField(
        customObj,
        Types.primitiveDataTypes.Text,
        'Something',
      )
      const afterField = createField(
        customObj,
        Types.primitiveDataTypes.Time,
        'Something',
      )
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error when changing a field type to a valid formula type', async () => {
      const beforeField = createField(
        customObj,
        Types.primitiveDataTypes.Number,
        'Something',
      )
      const afterField = createField(
        customObj,
        Types.formulaDataTypes.FormulaNumber,
        'Something',
      )
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error when creating a field with a valid field type', async () => {
      const field = createField(
        customObj,
        Types.primitiveDataTypes.Checkbox,
        'Something',
      )
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await customFieldTypeValidator([
        toChange({ before: customObj, after: customObj.clone() }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have no error when trying to create custom object with system fields', async () => {
      const field = new Field(
        customObj,
        CUSTOM_OBJECT_ID_FIELD,
        BuiltinTypes.SERVICE_ID,
      )
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(0)
    })
  })
})
