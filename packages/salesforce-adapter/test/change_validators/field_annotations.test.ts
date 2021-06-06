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
import {
  ChangeError, ElemID, Field, ObjectType, toChange,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import readOnlyAnnotationsValidator from '../../src/change_validators/field_annotations'
import { CUSTOM_OBJECT, FIELD_ANNOTATIONS } from '../../src/constants'
import { createField } from '../utils'

describe('READ ONLY annotations modification change validator', () => {
  describe('onUpdate', () => {
    let afterField: Field
    let beforeField: Field
    let customObj: ObjectType
    beforeAll(() => {
      customObj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
        annotations: { metadataType: CUSTOM_OBJECT, apiName: 'obj__c' },
      })
      beforeField = createField(customObj, Types.primitiveDataTypes.Text, 'Something', { [FIELD_ANNOTATIONS.CREATABLE]: 'testCreatable',
        [FIELD_ANNOTATIONS.UPDATEABLE]: 'testUpdateable',
        [FIELD_ANNOTATIONS.QUERYABLE]: 'testQueryable' })
    })
    beforeEach(() => {
      afterField = beforeField.clone()
    })

    const runChangeValidator = (before: Field | undefined, after: Field):
            Promise<ReadonlyArray<ChangeError>> =>
      readOnlyAnnotationsValidator([toChange({ before, after })])

    it('should have Error for READ ONLY annotation been modified, "creatable" annotation', async () => {
      afterField.annotations[FIELD_ANNOTATIONS.CREATABLE] = 'different'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Warning')
    })

    it('should have Error for READ ONLY annotation been modified, "Queyable" annotation', async () => {
      afterField.annotations[FIELD_ANNOTATIONS.QUERYABLE] = 'different'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Warning')
    })

    it('should have Error for READ ONLY annotation been modified, "Updateable" annotation', async () => {
      afterField.annotations[FIELD_ANNOTATIONS.UPDATEABLE] = 'different'
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Warning')
    })

    it('should have no errors, because no modification has been made', async () => {
      const changeErrors = await runChangeValidator(beforeField, afterField)
      expect(changeErrors).toHaveLength(0)
    })
  })
})
