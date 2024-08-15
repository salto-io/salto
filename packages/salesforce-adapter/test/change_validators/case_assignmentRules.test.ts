/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Change, toChange } from '@salto-io/adapter-api'
import caseChangeValidator from '../../src/change_validators/case_assignmentRules'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('case AssignmentRules change validator', () => {
  let caseRuleChange: Change
  describe('case AssignmentRules with case teams', () => {
    beforeEach(() => {
      const caseRule = createInstanceElement(
        {
          fullName: 'Case',
          assignmentRule: [
            {
              ruleEntry: [{ assignedTo: 'user1' }, { assignedTo: 'user2', team: 'team1' }],
            },
          ],
        },
        mockTypes.AssignmentRules,
      )
      caseRuleChange = toChange({ after: caseRule })
    })

    it('should throw an error', async () => {
      const changeErrors = await caseChangeValidator([caseRuleChange])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('case AssignmentRules without case teams', () => {
    beforeEach(() => {
      const caseRule = createInstanceElement(
        {
          fullName: 'Case',
          assignmentRule: [{ ruleEntry: [{ assignedTo: 'user1' }, { assignedTo: 'user2' }] }],
        },
        mockTypes.AssignmentRules,
      )
      caseRuleChange = toChange({ after: caseRule })
    })

    it('should not throw any error', async () => {
      const changeErrors = await caseChangeValidator([caseRuleChange])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
