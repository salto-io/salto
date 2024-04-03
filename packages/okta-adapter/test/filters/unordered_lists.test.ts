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

import { ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import {
  GROUP_MEMBERSHIP_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  OKTA,
  PASSWORD_RULE_TYPE_NAME,
} from '../../src/constants'
import unorderedListsFilter from '../../src/filters/unordered_lists'
import { getFilterParams } from '../utils'

describe('unorderedListsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  beforeEach(() => {
    filter = unorderedListsFilter(getFilterParams()) as typeof filter
  })

  describe('GroupRule instances', () => {
    const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
    const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })

    it('should order group rule target group list', async () => {
      const groupA = new InstanceElement('A', groupType, { id: 'A1', profile: { name: 'A' } })
      const groupB = new InstanceElement('B', groupType, { id: 'B2', profile: { name: 'B' } })
      const groupC = new InstanceElement('C', groupType, { id: 'C3', profile: { name: 'C' } })
      const groupRule = new InstanceElement('rulez', groupRuleType, {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: {
          assignUserToGroups: {
            groupIds: [
              new ReferenceExpression(groupB.elemID, groupB),
              new ReferenceExpression(groupC.elemID, groupC),
              new ReferenceExpression(groupA.elemID, groupA),
            ],
          },
        },
      })
      await filter.onFetch([groupType, groupRuleType, groupA, groupB, groupC, groupRule])
      expect(groupRule.value.actions.assignUserToGroups.groupIds).toEqual([
        new ReferenceExpression(groupA.elemID, groupA),
        new ReferenceExpression(groupB.elemID, groupB),
        new ReferenceExpression(groupC.elemID, groupC),
      ])
    })
  })

  describe('PasswordPolicyRule instances', () => {
    const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, PASSWORD_RULE_TYPE_NAME) })

    it('should order password policy rule methods list', async () => {
      const policyRuleInstance = new InstanceElement('rulesA', policyRuleType, {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: {
          selfServicePasswordReset: {
            access: 'ALLOW',
            requirement: {
              primary: {
                methods: ['push', 'email', 'voice', 'sms'],
              },
            },
          },
        },
      })
      await filter.onFetch([policyRuleType, policyRuleInstance])
      expect(policyRuleInstance.value.actions.selfServicePasswordReset.requirement.primary.methods).toEqual([
        'email',
        'push',
        'sms',
        'voice',
      ])
    })

    it('should do nothing if there are no methods defined', async () => {
      const policyRuleInstance = new InstanceElement('rulesA', policyRuleType, {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: {
          selfServicePasswordReset: { access: 'ALLOW' },
          selfServiceUnlock: { access: 'DENY' },
        },
      })
      await filter.onFetch([policyRuleType, policyRuleInstance])
      expect(policyRuleInstance.value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: {
          selfServicePasswordReset: { access: 'ALLOW' },
          selfServiceUnlock: { access: 'DENY' },
        },
      })
    })
  })

  describe('GroupMembership instances', () => {
    const groupMembershipType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_MEMBERSHIP_TYPE_NAME) })
    it('should sort group membership members list', async () => {
      const inst = new InstanceElement('inst', groupMembershipType, { members: ['c', 'a', 'b'] })
      await filter.onFetch([inst, groupMembershipType])
      expect(inst.value.members).toEqual(['a', 'b', 'c'])
    })
  })
})
