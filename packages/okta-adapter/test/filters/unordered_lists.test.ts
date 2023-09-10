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

import { ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, OKTA } from '../../src/constants'
import unorderedListsFilter from '../../src/filters/unordered_lists'
import { getFilterParams } from '../utils'

describe('unorderedListsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })

  beforeEach(() => {
    filter = unorderedListsFilter(getFilterParams()) as typeof filter
  })

  it('should order group rule target group list', async () => {
    const groupA = new InstanceElement('A', groupType, { id: 'A1', profile: { name: 'A' } })
    const groupB = new InstanceElement('B', groupType, { id: 'B2', profile: { name: 'B' } })
    const groupC = new InstanceElement('C', groupType, { id: 'C3', profile: { name: 'C' } })
    const groupRule = new InstanceElement(
      'rulez',
      groupRuleType,
      {
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
      },
    )
    await filter.onFetch([groupType, groupRuleType, groupA, groupB, groupC, groupRule])
    expect(groupRule.value.actions.assignUserToGroups.groupIds).toEqual([
      new ReferenceExpression(groupA.elemID, groupA),
      new ReferenceExpression(groupB.elemID, groupB),
      new ReferenceExpression(groupC.elemID, groupC),
    ])
  })
})
