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

import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, OKTA, ROLE_ASSIGNMENT_TYPE_NAME } from '../../src/constants'
import { getTargetGroupsForRule, roleAssignmentValidator } from '../../src/change_validators/role_assignment'

describe('addRoleToTargetGroupValidator', () => {
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const roleAssignmentType = new ObjectType({ elemID: new ElemID(OKTA, ROLE_ASSIGNMENT_TYPE_NAME) })
  const msg = 'Unable to assign admin role to group.'

  const group1 = new InstanceElement('group1', groupType, { type: 'OKTA_GROUP', profile: { name: 'group1' } })

  const group2 = new InstanceElement('group2', groupType, { type: 'OKTA_GROUP', profile: { name: 'group2' } })

  const groupRule1 = new InstanceElement('groupRule1', groupRuleType, {
    name: 'rule',
    status: 'ACTIVE',
    conditions: {},
    actions: {
      assignUserToGroups: {
        groupIds: [new ReferenceExpression(group1.elemID, group1)],
      },
    },
  })

  it('should return error because the group is already assined to group rule', async () => {
    const groupRule2 = new InstanceElement('groupRule2', groupRuleType, {
      name: 'rule',
      status: 'ACTIVE',
      conditions: {},
      actions: {
        assignUserToGroups: {
          groupIds: [new ReferenceExpression(group1.elemID, group1)],
        },
      },
    })

    const roleAssign = new InstanceElement(
      'role1',
      roleAssignmentType,
      { type: 'CUSTOM', label: 'some role' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(group1.elemID, group1)] },
    )

    const elementSource = buildElementsSourceFromElements([
      groupType,
      groupRuleType,
      group1,
      groupRule1,
      groupRule2,
      roleAssign,
      roleAssignmentType,
    ])
    const changes = [toChange({ after: roleAssign })]
    const changeErrors = await roleAssignmentValidator(changes, elementSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: roleAssign.elemID,
        severity: 'Error',
        message: msg,
        detailedMessage: `Element ${group1.elemID.name} of type ${GROUP_TYPE_NAME} cannot be assigned an administrator role because it is a target group in the following ${GROUP_RULE_TYPE_NAME} elements: [${[groupRule1.elemID.name, groupRule2.elemID.name].join(', ')}]. Please remove all the relevant GroupRules before assigning it an administrator role, or assign the role to a different group.`,
      },
    ])
  })
  it('shoult not return error because the group is not assined to group rule', async () => {
    const roleAssign2 = new InstanceElement(
      'role2',
      roleAssignmentType,
      { type: 'CUSTOM', label: 'some role' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(group2.elemID, group2)] },
    )

    const elementSource = buildElementsSourceFromElements([
      groupType,
      groupRuleType,
      group1,
      group2,
      roleAssign2,
      roleAssignmentType,
    ])

    const changes = [toChange({ after: roleAssign2 })]
    const changeErrors = await roleAssignmentValidator(changes, elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  describe('getTargetGroupsForRule', () => {
    it('should return the target groups for the rule', () => {
      const targetGroups = getTargetGroupsForRule(groupRule1)
      expect(targetGroups).toHaveLength(1)
      expect(targetGroups).toEqual([group1.elemID.name])
    })
    it('should return empty array when there are no target groups', () => {
      const groupRule = new InstanceElement('groupRule1', groupRuleType, {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: {
          assignUserToGroups: {
            groupIds: [],
          },
        },
      })
      const targetGroups = getTargetGroupsForRule(groupRule)
      expect(targetGroups).toHaveLength(0)
      expect(targetGroups).toEqual([])
    })
  })
})
