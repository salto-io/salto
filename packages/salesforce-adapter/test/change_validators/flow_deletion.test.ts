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
import { toChange } from '@salto-io/adapter-api'
import flowDeletionChangeValidator from '../../src/change_validators/flow_deletion'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('flow deletion change validator', () => {
  describe('delete a draft flow', () => {
    const beforeRecord = createInstanceElement({ fullName: 'flow1', status: 'Draft' }, mockTypes.Flow)

    it('should have no error when trying to delete a draft flow', async () => {
      const changeErrors = await flowDeletionChangeValidator(
        [toChange({ before: beforeRecord })]
      )
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('delete an active flow', () => {
    const beforeRecord = createInstanceElement({ fullName: 'flow2', status: 'Active' }, mockTypes.Flow)
    it('should have error when trying to delete an active flow', async () => {
      const changeErrors = await flowDeletionChangeValidator(
        [toChange({ before: beforeRecord })]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeRecord.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
})
