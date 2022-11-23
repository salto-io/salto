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
import { Change, getAllChangeData, toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/fullname_changed'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

describe('fullname change validator', () => {
  describe('when fullname changes', () => {
    let fullnameChange: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'original_fullname' }, mockTypes.RecordType)
      const afterRecord = beforeRecord.clone()
      afterRecord.value[INSTANCE_FULL_NAME_FIELD] = 'modified_fullname'
      fullnameChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should fail validation', async () => {
      const changeErrors = await changeValidator(
        [fullnameChange]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      const [beforeData] = getAllChangeData(fullnameChange)
      expect(changeError.elemID).toEqual(beforeData?.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('when fullname does not change', () => {
    let fullnameChange: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'original_fullname', status: 'ACTIVE' }, mockTypes.Flow)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.status = 'INACTIVE'
      fullnameChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation', async () => {
      const changeErrors = await changeValidator(
        [fullnameChange]
      )
      expect(changeErrors).toBeEmpty()
    })
  })
})
