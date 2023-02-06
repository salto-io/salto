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
import { Element, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { naclCase, findObjectType } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { ROLE_TYPE_NAME, OKTA } from '../constants'

const { RECORDS_PATH } = elementUtils

/**
 * Source for standard roles definitions:
 * https://developer.okta.com/docs/concepts/role-assignment/#standard-role-types
 */
const ROLE_TYPE_TO_LABEL: Record<string, string> = {
  API_ACCESS_MANAGEMENT_ADMIN: 'API Access Management Administrator',
  APP_ADMIN: 'Application Administrator',
  GROUP_MEMBERSHIP_ADMIN: 'Group Membership Administrator',
  HELP_DESK_ADMIN: 'Help Desk Administrator',
  MOBILE_ADMIN: 'Mobile Administrator',
  ORG_ADMIN: 'Organizational Administrator',
  READ_ONLY_ADMIN: 'Read-Only Administrator',
  REPORT_ADMIN: 'Report Administrator',
  SUPER_ADMIN: 'Super Administrator',
  USER_ADMIN: 'Group Administrator',
}

const ROLE_ELEM_ID = new ElemID(OKTA, ROLE_TYPE_NAME)

/**
 * Create standard role instances,
 * which are not returned by the API but are useful for impact analysis
 */
const filter: FilterCreator = () => ({
  name: 'standardRolesFilter',
  onFetch: async (elements: Element[]) => {
    const roleObjectType = findObjectType(elements, ROLE_ELEM_ID)
    if (roleObjectType === undefined) {
      return
    }
    const standardRoles = Object.keys(ROLE_TYPE_TO_LABEL).map(roleTypeName =>
      new InstanceElement(
        naclCase(ROLE_TYPE_TO_LABEL[roleTypeName]),
        roleObjectType,
        {
          id: roleTypeName,
          label: ROLE_TYPE_TO_LABEL[roleTypeName],
          type: roleTypeName,
        },
        [OKTA, RECORDS_PATH, ROLE_TYPE_NAME, roleTypeName],
      ))
    elements.push(...standardRoles)
  },
})

export default filter
