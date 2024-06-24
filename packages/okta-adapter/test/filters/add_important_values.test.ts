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
import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_important_values'
import {
  APPLICATION_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  ACCESS_POLICY_RULE_TYPE_NAME,
  OKTA,
} from '../../src/constants'
import { getFilterParams } from '../utils'

describe('add important values filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const accessType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })
  const accessRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })

  beforeEach(async () => {
    filter = filterCreator(getFilterParams()) as FilterType
  })

  describe('onFetch', () => {
    it('should add important values annotation correctly', async () => {
      await filter.onFetch([appType, groupRuleType, accessType, accessRuleType])
      expect(appType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        {
          value: 'label',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'signOnMode',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'status',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'accessPolicy',
          highlighted: false,
          indexed: true,
        },
        {
          value: 'profileEnrollment',
          highlighted: false,
          indexed: true,
        },
      ])
      expect(groupRuleType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        {
          value: 'name',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'status',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'actions.assignUserToGroups.groupIds',
          highlighted: false,
          indexed: true,
        },
        {
          value: 'allGroupsValid',
          highlighted: false,
          indexed: true,
        },
      ])
      expect(accessType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'status', highlighted: true, indexed: true },
      ])
      expect(accessRuleType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'status', highlighted: true, indexed: true },
      ])
    })
  })
})
