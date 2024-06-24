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
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import unknownFieldValidator from '../../src/change_validators/unknown_field'
import { createField } from '../utils'

describe('unknown field change validator', () => {
  describe('onUpdate', () => {
    let obj: ObjectType
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

    const runChangeValidator = (
      before: Field | undefined,
      after: Field,
    ): Promise<ReadonlyArray<ChangeError>> =>
      unknownFieldValidator([toChange({ before, after })])

    it('should have error for unknown field modification', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Unknown,
        'Something',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have error for unknown field creation', async () => {
      const field = createField(
        obj,
        Types.primitiveDataTypes.Unknown,
        'Something',
      )
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(field.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have no error when changing a field with a valid type', async () => {
      const beforeField = createField(
        obj,
        Types.primitiveDataTypes.Text,
        'Something',
      )
      const afterField = createAfterField(beforeField)
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error when creating a field with a valid type', async () => {
      const field = createField(
        obj,
        Types.primitiveDataTypes.Checkbox,
        'Something',
      )
      const changeErrors = await runChangeValidator(undefined, field)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await unknownFieldValidator([
        toChange({ before: obj, after: obj.clone() }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
