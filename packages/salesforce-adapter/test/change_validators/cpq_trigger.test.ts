/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ElemID, ObjectType, toChange,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import cpqChangeValidator from '../../src/change_validators/cpq_trigger'
import { createField } from '../utils'

describe('cpq trigger change validator', () => {
  const objCpq = new ObjectType({
    elemID: new ElemID('salesforce', 'SBQQ__cpqElement'),
  })
  describe('onUpdate', () => {
    it('should have error when cpq element has been modified', async () => {
      const beforeField = createField(objCpq, Types.primitiveDataTypes.Time, 'Something')
      const afterField = createField(objCpq, Types.primitiveDataTypes.Time, 'Something else')
      const changeErrors = await cpqChangeValidator(
        [toChange({ before: beforeField, after: afterField })]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeField.elemID)
      expect(changeError.severity).toEqual('Info')
      expect(changeError.deployActions).toBeDefined()
    })

    it('should have error when cpq element has been deleted', async () => {
      const changeErrors = await cpqChangeValidator(
        [toChange({ before: objCpq, after: undefined })]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(objCpq.elemID)
      expect(changeError.severity).toEqual('Info')
      expect(changeError.deployActions).toBeDefined()
    })

    it('should have error when cpq element has been created', async () => {
      const changeErrors = await cpqChangeValidator(
        [toChange({ before: undefined, after: objCpq })]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(objCpq.elemID)
      expect(changeError.severity).toEqual('Info')
      expect(changeError.deployActions).toBeDefined()
    })
  })
})
