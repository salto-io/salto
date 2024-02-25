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
  Element,
  InstanceElement,
  isInstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  ObjectType,
  ElemID,
  BuiltinTypes,
  ListType,
} from '@salto-io/adapter-api'
import { elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME, GROUP_MEMBERSHIP_TYPE_NAME, OKTA } from '../constants'
import { areUsers, User } from '../user_utils'
import { FETCH_CONFIG } from '../config'

const log = logger(module)
const { RECORDS_PATH, TYPES_PATH } = elementUtils
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const createGroupMembershipType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, GROUP_MEMBERSHIP_TYPE_NAME),
    fields: {
      members: { refType: new ListType(BuiltinTypes.STRING) },
    },
    path: [OKTA, TYPES_PATH, GROUP_MEMBERSHIP_TYPE_NAME],
  })

const getGroupMembersData = async (paginator: clientUtils.Paginator, group: InstanceElement): Promise<User[]> => {
  const paginationArgs = {
    url: `/api/v1/groups/${group.value.id}/users`,
    paginationField: 'after',
  }
  const members = (
    await toArrayAsync(paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[]))
  ).flat()
  if (!areUsers(members)) {
    log.error(`Recived invalid response while trying to get members for group: ${group.elemID.getFullName()}`)
    return []
  }
  return members
}

const createGroupMembershipInstance = async (
  group: InstanceElement,
  groupMembersType: ObjectType,
  paginator: clientUtils.Paginator,
): Promise<InstanceElement | undefined> => {
  const groupName = group.elemID.name
  const groupMembersData = await getGroupMembersData(paginator, group)
  return groupMembersData.length > 0
    ? new InstanceElement(
        groupName,
        groupMembersType,
        { members: groupMembersData.map(member => member.profile.login) },
        [OKTA, RECORDS_PATH, GROUP_MEMBERSHIP_TYPE_NAME, pathNaclCase(groupName)],
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(group.elemID, group)] },
      )
    : undefined
}

/**
 * Create a single group-memberships instance per group.
 */
const groupMembersFilter: FilterCreator = ({ config, paginator }) => ({
  name: 'groupMembersFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (!config[FETCH_CONFIG].includeGroupMemberships) {
      log.debug('Fetch of group members is disabled')
      return
    }
    const groupInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)

    const groupMembersType = createGroupMembershipType()
    elements.push(groupMembersType)

    const groupMembershipInstances = (
      await Promise.all(
        groupInstances.map(async groupInstance =>
          createGroupMembershipInstance(groupInstance, groupMembersType, paginator),
        ),
      )
    ).filter(isInstanceElement)

    groupMembershipInstances.forEach(instance => elements.push(instance))
  },
})

export default groupMembersFilter
