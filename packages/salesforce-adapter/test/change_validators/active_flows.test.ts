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
import { Change, InstanceElement, toChange } from '@salto-io/adapter-api'
import activeFlowChangeValidator from '../../src/change_validators/active_flows'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('active flows change validator', () => {
  let flowChanges: Change
  describe('deactivate a flow', () => {
    let beforeRecord: InstanceElement
    let statusChange: InstanceElement
    let otherModifications: InstanceElement
    beforeEach(() => {
      beforeRecord = createInstanceElement({ fullName: 'flow1', status: 'Active', actionType: 'quick' }, mockTypes.Flow)
      statusChange = beforeRecord.clone()
      statusChange.value.status = 'Obsolete'
      otherModifications = statusChange.clone()
      otherModifications.value.actionType = 'case'
    })

    it('should have error when trying to deactivate a flow', async () => {
      flowChanges = toChange({ before: beforeRecord, after: statusChange })
      const changeErrors = await activeFlowChangeValidator(
        [flowChanges]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Error')
    })

    it('should inform that a new inactive flow version will be created', async () => {
      flowChanges = toChange({ before: beforeRecord, after: otherModifications })
      const changeErrors = await activeFlowChangeValidator(
        [flowChanges]
      )
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
    })
  })
  describe('editing an active flow', () => {
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'flow2', status: 'Active', actionType: 'quick' }, mockTypes.Flow)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.actionType = 'case'
      flowChanges = toChange({ before: beforeRecord, after: afterRecord })
    })
    describe('sandbox env', () => {
      it('should have info message regarding the new flow version', async () => {
        const changeErrors = await activeFlowChangeValidator(
          [flowChanges]
        )
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.severity).toEqual('Info')
      })
    })
    describe('non-sandbox env', () => {
      it('should have info message and post deploy action regarding the new flow version', async () => {
        const changeErrors = await activeFlowChangeValidator(
          [flowChanges]
        ) // config enablActiveDeploy true
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.severity).toEqual('Info')
      })
      it('should have info message regarding the new flow version', async () => {
        const changeErrors = await activeFlowChangeValidator(
          [flowChanges]
        ) // config enablActiveDeploy false
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.severity).toEqual('Info')
      })
    })
  })
  describe('activating a flow', () => {
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'flow3', status: 'Draft', actionType: 'quick' }, mockTypes.Flow)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.state = 'Active'
      flowChanges = toChange({ before: beforeRecord, after: afterRecord })
    })
    it('should have info message and post deploy action regarding the new flow version', async () => {
      const changeErrors = await activeFlowChangeValidator(
        [flowChanges]
      ) // config enablActiveDeploy true
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
    })
    it('should have error message regarding the new flow version', async () => {
      const changeErrors = await activeFlowChangeValidator(
        [flowChanges]
      ) // config enablActiveDeploy false
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
    })
  })
  describe('adding an active flow', () => {
    beforeEach(() => {
      const afterRecord = createInstanceElement({ fullName: 'flow2', status: 'Active', actionType: 'quick' }, mockTypes.Flow)
      flowChanges = toChange({ after: afterRecord })
    })
    it('should have post deploy action regarding the new flow version', async () => {
      const changeErrors = await activeFlowChangeValidator(
        [flowChanges]
      ) // config enablActiveDeploy true
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
    })
    it('should have error message regarding the new flow version', async () => {
      const changeErrors = await activeFlowChangeValidator(
        [flowChanges]
      ) // config enablActiveDeploy false
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
    })
  })
  describe('adding and editing a draft flow', () => {
    describe('add a new draft flow', () => {
      beforeEach(() => {
        const afterRecord = createInstanceElement({ fullName: 'flow2', status: 'Draft', actionType: 'quick' }, mockTypes.Flow)
        flowChanges = toChange({ after: afterRecord })
      })
      it('should not throw any error', async () => {
        const changeErrors = await activeFlowChangeValidator(
          [flowChanges]
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('edit draft flow', () => {
      beforeEach(() => {
        const beforeRecord = createInstanceElement({ fullName: 'flow2', status: 'Draft', actionType: 'quick' }, mockTypes.Flow)
        const afterRecord = beforeRecord.clone()
        afterRecord.value.actionType = 'fast'
        flowChanges = toChange({ before: beforeRecord, after: afterRecord })
      })
      it('should not throw any error', async () => {
        const changeErrors = await activeFlowChangeValidator(
          [flowChanges]
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})
