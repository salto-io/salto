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
import activeFlowChangeValidator from '../../src/change_validators/active_flow_modifications'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('active flow editing change validator', () => {
  let flowChange: Change
  describe('deactivate a flow', () => {
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'flow1', status: 'Active' }, mockTypes.Flow)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.status = 'Obsolete'
      flowChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should have error when trying to deactivate a flow', async () => {
      const changeErrors = await activeFlowChangeValidator(
        [flowChange]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      const beforeData = getAllChangeData(flowChange)[0]
      expect(changeError.elemID).toEqual(beforeData?.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('editing a non draft flow', () => {
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'flow2', status: 'Active', actionType: 'quick' }, mockTypes.Flow)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.actionType = 'fast'
      flowChange = toChange({ before: beforeRecord, after: afterRecord })
    })
    it('should have info message regarding the new flow version', async () => {
      const changeErrors = await activeFlowChangeValidator(
        [flowChange]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      const beforeData = getAllChangeData(flowChange)[0]
      expect(changeError.elemID).toEqual(beforeData?.elemID)
      expect(changeError.severity).toEqual('Info')
    })
  })
})
