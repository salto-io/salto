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
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { Options } from '../definitions/types'
import { UserConfig } from '../config'
import { getUsersIndex } from '../users'
import { BLOG_POST_TYPE_NAME, PAGE_TYPE_NAME, SPACE_TYPE_NAME } from '../constants'

export const TYPE_NAME_TO_USER_FIELDS: Record<string, string[]> = {
  [PAGE_TYPE_NAME]: ['authorId', 'ownerId'],
  [SPACE_TYPE_NAME]: ['authorId'],
  [BLOG_POST_TYPE_NAME]: ['authorId'],
}

const TYPE_NAMES_WITH_USERS = Object.keys(TYPE_NAME_TO_USER_FIELDS)

export const FALLBACK_DISPLAY_NAME = 'UNKNOWN'

/*
 * Creates record from groupId to its name
 */
const getGroupsIndex = (instances: InstanceElement[]): Record<string, string> => {
  const groupsInstances = instances.filter(inst => inst.elemID.typeName === 'group')
  return Object.fromEntries(groupsInstances.map(inst => [inst.value.id, inst.value.name]))
}

const filter: filterUtils.AdapterFilterCreator<UserConfig, filterUtils.FilterResult, {}, Options> = ({
  definitions,
}) => ({
  name: 'groupsAndUsersFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const usersIndex = await getUsersIndex(definitions)
    const groupsIndex = getGroupsIndex(instances)
    instances.forEach(inst => {
      if (TYPE_NAMES_WITH_USERS.includes(inst.elemID.typeName)) {
        const userFields = TYPE_NAME_TO_USER_FIELDS[inst.elemID.typeName]
        userFields.forEach(field => {
          if (inst.value[field] !== undefined) {
            const { accountId } = inst.value[field]
            inst.value[field] = {
              accountId,
              displayName: usersIndex[accountId]?.displayName ?? FALLBACK_DISPLAY_NAME,
            }
          }
        })
      }
      if (inst.elemID.typeName === SPACE_TYPE_NAME) {
        // special treatment for space permissions
        const { permissions } = inst.value
        if (Array.isArray(permissions)) {
          permissions.forEach(permission => {
            const { type } = permission
            permission.displayName =
              (type === 'user'
                ? usersIndex[permission.principalId]?.displayName
                : groupsIndex[permission.principalId]) ?? FALLBACK_DISPLAY_NAME
          })
        }
      }
    })
  },
})

export default filter
