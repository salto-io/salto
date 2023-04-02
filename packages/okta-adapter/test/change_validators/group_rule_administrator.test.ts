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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { groupRuleAdministratorValidator } from '../../src/change_validators/group_rule_administrator'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, OKTA, ROLE_TYPE_NAME } from '../../src/constants'

describe('groupRuleAdministratorValidator', () => {
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const RoleType = new ObjectType({ elemID: new ElemID(OKTA, ROLE_TYPE_NAME) })
  const msg = 'Group membership rules cannot be created for groups with administrator roles.'

  const role1 = new InstanceElement(
    'role1',
    RoleType,
  )

  const group1 = new InstanceElement(
    'group1',
    groupType,
    { type: 'OKTA_GROUP', profile: { name: 'group1' }, roles: [new ReferenceExpression(role1.elemID, role1)] },
  )

  const group3 = new InstanceElement(
    'group3',
    groupType,
    { type: 'OKTA_GROUP', profile: { name: 'group3' } },
  )
  const group4 = new InstanceElement(
    'group4',
    groupType,
    { type: 'OKTA_GROUP', profile: { name: 'group4' }, roles: [] },
  )

  it('should return errors because the groups associated has roles', async () => {
    const group2 = new InstanceElement(
      'group2',
      groupType,
      { type: 'OKTA_GROUP', profile: { name: 'group2' }, roles: [new ReferenceExpression(role1.elemID, role1)] },
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
      'groupRule2',
      groupRuleType,
      {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: { assignUserToGroups: { groupIds: [new ReferenceExpression(group1.elemID, group1),
          new ReferenceExpression(group2.elemID, group2)] } },
      },
    )

    const groupRule4 = new InstanceElement(
      'groupRule4',
      groupRuleType,
      {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: { assignUserToGroups: { groupIds: [new ReferenceExpression(group3.elemID, group3),
          new ReferenceExpression(group4.elemID, group4), new ReferenceExpression(group1.elemID, group1)] } },
      },
    )

    const changes = [toChange({ after: groupRule1 }), toChange({ after: groupRule2 }), toChange({ after: groupRule4 })]
    const changeErrors = await groupRuleAdministratorValidator(changes)
    expect(changeErrors).toHaveLength(3)
    expect(changeErrors).toEqual([{
      elemID: groupRule1.elemID,
      severity: 'Error',
      message: msg,
      detailedMessage: `Rules cannot assign users to groups with administrator roles. The following groups have administrator roles: ${[group1.elemID.name].join(', ')}.`,
    },
    {
      elemID: groupRule2.elemID,
      severity: 'Error',
      message: msg,
      detailedMessage: `Rules cannot assign users to groups with administrator roles. The following groups have administrator roles: ${[group1.elemID.name, group2.elemID.name].join(', ')}.`,
    },
    {
      elemID: groupRule4.elemID,
      severity: 'Error',
      message: msg,
      detailedMessage: `Rules cannot assign users to groups with administrator roles. The following groups have administrator roles: ${[group1.elemID.name].join(', ')}.`,
    }])
  })

  it('should not return errors because the groups associated has no roles or roles are empty', async () => {
    const groupRule3 = new InstanceElement(
      'groupRule3',
      groupRuleType,
      {
        name: 'rule',
        status: 'ACTIVE',
        conditions: {},
        actions: { assignUserToGroups: { groupIds: [new ReferenceExpression(group3.elemID, group3),
          new ReferenceExpression(group4.elemID, group4)] } },
      },
    )

    const changes = [toChange({ after: groupRule3 })]
    const changeErrors = await groupRuleAdministratorValidator(changes)
    expect(changeErrors).toHaveLength(0)
  })
})
