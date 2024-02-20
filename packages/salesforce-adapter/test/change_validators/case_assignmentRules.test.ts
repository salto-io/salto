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
              ruleEntry: [
                { assignedTo: 'user1' },
                { assignedTo: 'user2', team: 'team1' },
              ],
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
          assignmentRule: [
            { ruleEntry: [{ assignedTo: 'user1' }, { assignedTo: 'user2' }] },
          ],
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
