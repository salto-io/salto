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
import standardFieldLabelValidator from '../../src/change_validators/standard_field_label'
import { CUSTOM_OBJECT, LABEL } from '../../src/constants'
import { createField } from '../utils'

describe('standard field label modification change validator', () => {
  describe('onUpdate', () => {
    let customObj: ObjectType
    beforeEach(() => {
      customObj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
        annotations: { metadataType: CUSTOM_OBJECT },
      })
    })

    const createAnnotatedField = (parent: ObjectType, fieldType: TypeElement,
      fieldApiName: string): Field => {
      const field = createField(parent, fieldType, fieldApiName)
      field.annotate({ [LABEL]: 'testLabel' })
      return field
    }

    const runChangeValidator = (before: Field | undefined, after: Field):
          Promise<ReadonlyArray<ChangeError>> =>
      standardFieldLabelValidator([toChange({ before, after })])

    it('should have warning for standard field label modification', async () => {
      const beforeField = createAnnotatedField(customObj, Types.primitiveDataTypes.Time, 'Something')
      const afterField = beforeField.clone()
      afterField.annotations[LABEL] = 'differentLabel'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Warning')
    })

    it('should have no warnings for custom field label modification', async () => {
      const beforeField = createAnnotatedField(customObj, Types.primitiveDataTypes.Text, 'Something')
      beforeField.name = 'field__c' // make it a custom field
      const afterField = beforeField.clone()
      afterField.annotations[LABEL] = 'differentLabel'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no warnings for modification of different annotations in standard field', async () => {
      const beforeField = createAnnotatedField(customObj, Types.primitiveDataTypes.Text, 'Something')
      const afterField = beforeField.clone()
      afterField.annotations.modifyMe = 'modified'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no error for object', async () => {
      const changeErrors = await standardFieldLabelValidator([
        toChange({ before: customObj, after: customObj.clone() }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
