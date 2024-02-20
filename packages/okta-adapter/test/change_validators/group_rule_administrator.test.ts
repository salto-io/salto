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
import { groupRuleAdministratorValidator } from '../../src/change_validators/group_rule_administrator'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, OKTA, ROLE_ASSIGNMENT_TYPE_NAME } from '../../src/constants'

describe('groupRuleAdministratorValidator', () => {
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const roleAssignmentType = new ObjectType({ elemID: new ElemID(OKTA, ROLE_ASSIGNMENT_TYPE_NAME) })
  const msg = 'Group membership rules cannot be created for groups with administrator roles.'

  const group1 = new InstanceElement('group1', groupType, { type: 'OKTA_GROUP', profile: { name: 'group1' } })

  const group3 = new InstanceElement('group3', groupType, { type: 'OKTA_GROUP', profile: { name: 'group3' } })
  const group4 = new InstanceElement('group4', groupType, { type: 'OKTA_GROUP', profile: { name: 'group4' } })

  const group2 = new InstanceElement('group2', groupType, { type: 'OKTA_GROUP', profile: { name: 'group2' } })

  const roleAssign = new InstanceElement(
    'role1',
    roleAssignmentType,
    { type: 'CUSTOM', label: 'some role' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(group2.elemID, group2)] },
  )

  it('should return errors because the groups associated has roles', async () => {
    const groupRule1 = new InstanceElement('groupRule1', groupRuleType, {
      name: 'rule',
      status: 'ACTIVE',
      conditions: {},
      actions: {
        assignUserToGroups: {
          groupIds: [new ReferenceExpression(group1.elemID, group1), new ReferenceExpression(group2.elemID, group2)],
        },
      },
    })

    const elementSource = buildElementsSourceFromElements([
      groupType,
      groupRuleType,
      group1,
      group2,
      groupRule1,
      roleAssign,
      roleAssignmentType,
    ])
    const changes = [toChange({ after: groupRule1 })]
    const changeErrors = await groupRuleAdministratorValidator(changes, elementSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: groupRule1.elemID,
        severity: 'Error',
        message: msg,
        detailedMessage: `Rules cannot assign users to groups with administrator roles. The following groups have administrator roles: ${[group2.elemID.name].join(', ')}. Please remove role assignemnts from groups or choose different groups as targets for this rule.`,
      },
    ])
  })

  it('should not return errors because the groups has no roles', async () => {
    const groupRule3 = new InstanceElement('groupRule3', groupRuleType, {
      name: 'rule',
      status: 'ACTIVE',
      conditions: {},
      actions: {
        assignUserToGroups: {
          groupIds: [new ReferenceExpression(group3.elemID, group3), new ReferenceExpression(group4.elemID, group4)],
        },
      },
    })
    const elementSource = buildElementsSourceFromElements([
      groupType,
      groupRuleType,
      group2,
      group3,
      group4,
      groupRule3,
      roleAssignmentType,
      roleAssign,
    ])
    const changes = [toChange({ after: groupRule3 })]
    const changeErrors = await groupRuleAdministratorValidator(changes, elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing when element source is missing', async () => {
    const changeErrors = await groupRuleAdministratorValidator([
      toChange({ after: new InstanceElement('rule', groupRuleType, {}) }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
