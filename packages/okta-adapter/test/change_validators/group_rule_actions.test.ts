/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { groupRuleActionsValidator } from '../../src/change_validators/group_rule_actions'
import { OKTA, GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME } from '../../src/constants'

describe('groupRuleActionsValidator', () => {
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const group1 = new InstanceElement(
    'group1',
    groupType,
    { type: 'OKTA_GROUP', profile: { name: 'group1' } },
  )
  const group2 = new InstanceElement(
    'group2',
    groupType,
    { type: 'OKTA_GROUP', profile: { name: 'group2' } },
  )
  const groupRule1 = new InstanceElement(
    'groupRule1',
    groupRuleType,
    {
      name: 'rule',
      status: 'ACTIVE',
      conditions: {},
      actions: { assignUserToGroups: { groupIds: [new ReferenceExpression(group1.elemID, group1)] } },
    },
  )

  const groupRule2 = new InstanceElement(
    'groupRule1',
    groupRuleType,
    {
      name: 'rule',
      status: 'ACTIVE',
      actions: { assignUserToGroups: { groupIds: [new ReferenceExpression(group1.elemID, group1)] } },
    },
  )

  it('should return an error if actions object changed', async () => {
    const changedGroupRule1 = groupRule1.clone()
    changedGroupRule1.value.actions.assignUserToGroups.groupIds = [
      new ReferenceExpression(group1.elemID, group1),
      new ReferenceExpression(group2.elemID, group2),
    ]
    const changedGroupRule2 = groupRule1.clone()
    changedGroupRule2.value.actions.assignUserToGroups.groupIds = [new ReferenceExpression(group2.elemID, group2)]
    const changeErrors = await groupRuleActionsValidator(
      [
        toChange({ before: groupRule1, after: changedGroupRule1 }),
        toChange({ before: groupRule2, after: changedGroupRule1 }),
      ]
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: changedGroupRule1.elemID,
        severity: 'Error',
        message: `Cannot change ${GROUP_RULE_TYPE_NAME} actions`,
        detailedMessage: `Cannot change ${GROUP_RULE_TYPE_NAME} because actions section can not be changed for existing rules.`,
      },
      {
        elemID: changedGroupRule2.elemID,
        severity: 'Error',
        message: `Cannot change ${GROUP_RULE_TYPE_NAME} actions`,
        detailedMessage: `Cannot change ${GROUP_RULE_TYPE_NAME} because actions section can not be changed for existing rules.`,
      },
    ])
  })

  it('should return no error if actions object did not changed', async () => {
    const changedGroupRule1 = groupRule1.clone()
    changedGroupRule1.value.name = 'ruleee'
    const changeErrors = await groupRuleActionsValidator(
      [toChange({ before: groupRule1, after: changedGroupRule1 })]
    )
    expect(changeErrors).toHaveLength(0)
  })
})
