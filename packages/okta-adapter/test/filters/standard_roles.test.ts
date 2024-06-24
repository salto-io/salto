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

import { ObjectType, ElemID, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { OKTA, ROLE_TYPE_NAME } from '../../src/constants'
import standardRolesFilter from '../../src/filters/standard_roles'
import { getFilterParams } from '../utils'

describe('standardRolesFilter', () => {
  let roleType: ObjectType
  let filter: filterUtils.FilterWith<'onFetch'>
  // let elements: Element[]

  beforeEach(() => {
    filter = standardRolesFilter(getFilterParams()) as typeof filter
    roleType = new ObjectType({ elemID: new ElemID(OKTA, ROLE_TYPE_NAME) })
  })

  it('should create standard role instances', async () => {
    const elements = [roleType]
    await filter.onFetch?.(elements)
    const createdInstance = elements
      .filter(isInstanceElement)
      .map(element => element.elemID.getFullName())
      .sort()
    expect(createdInstance).toEqual([
      'okta.Role.instance.API_Access_Management_Administrator@s',
      'okta.Role.instance.Application_Administrator@s',
      'okta.Role.instance.Group_Administrator@s',
      'okta.Role.instance.Group_Membership_Administrator@s',
      'okta.Role.instance.Help_Desk_Administrator@s',
      'okta.Role.instance.Mobile_Administrator@s',
      'okta.Role.instance.Organizational_Administrator@s',
      'okta.Role.instance.Read_Only_Administrator@bs',
      'okta.Role.instance.Report_Administrator@s',
      'okta.Role.instance.Super_Administrator@s',
    ])
  })
})
