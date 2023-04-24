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

import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { GROUP_TYPE_NAME, OKTA } from '../../src/constants'
import groupRolesFilter from '../../src/filters/group_roles'
import { getFilterParams } from '../utils'

describe('groupRolesFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })

  beforeEach(() => {
    filter = groupRolesFilter(getFilterParams()) as typeof filter
  })

  describe('onFetch', () => {
    it('should replace create new fields from urls with ids', async () => {
      const groupInstance = new InstanceElement(
        'group',
        groupType,
        { id: 'AAA', profile: { name: 'everyone' }, roles: ['123', '1234'] },
      )
      await filter.onFetch?.([groupType, groupInstance])
      expect(groupInstance.value.roles).toEqual(undefined)
      expect(groupInstance.value).toEqual({ id: 'AAA', profile: { name: 'everyone' } },)
    })
    it('should do nothing if roles field is missing', async () => {
      const groupInstance = new InstanceElement(
        'group',
        groupType,
        { id: 'BBB', profile: { name: 'nobody', description: 'hi' } },
      )
      await filter.onFetch?.([groupInstance, groupType])
      expect(groupInstance.value).toEqual({ id: 'BBB', profile: { name: 'nobody', description: 'hi' } })
    })
  })
})
