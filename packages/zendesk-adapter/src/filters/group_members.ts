/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { Element, InstanceElement, isInstanceElement, CORE_ANNOTATIONS, ReferenceExpression, isObjectType } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME, GROUP_MEMBERS_TYPE_NAME, GROUP_MEMBERSHIP_TYPE_NAME, ZENDESK } from '../constants'

const log = logger(module)
const { RECORDS_PATH } = elementUtils

// TODO add validations

/**
 * Create a single group-memberships instance per group.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => log.time(async () => {
    const groupMembershipInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)

    if (groupMembershipInstances.length === 0) {
      return
    }

    const groupMembersType = elements.filter(isObjectType).find(
      e => e.elemID.typeName === GROUP_MEMBERS_TYPE_NAME
    )
    if (groupMembersType === undefined) {
      log.error('could not find %s type, aborting', GROUP_MEMBERS_TYPE_NAME)
      return
    }

    const groupInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)
    const groupsByInternalId = _.keyBy(groupInstances, inst => inst.value.id as number)

    const membershipsByGroup = _.groupBy(
      groupMembershipInstances.filter(
        inst => groupsByInternalId[inst.value.group_id] !== undefined
      ),
      inst => inst.value.group_id,
    )
    const groupMembershipInfo = _.mapValues(
      membershipsByGroup,
      instances => instances.map(inst => ({
        user: inst.value.user_id,
        default: inst.value.default,
      })),
    )

    const groupMembersInstances = Object.entries(groupMembershipInfo).map(([groupId, members]) => {
      const group = groupsByInternalId[groupId]
      const groupName = group.elemID.name
      return new InstanceElement(
        groupName,
        groupMembersType,
        { members },
        [ZENDESK, RECORDS_PATH, GROUP_MEMBERS_TYPE_NAME, pathNaclCase(groupName)],
        { [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(group.elemID, group),
        ] },
      )
    })

    _.pullAll(elements, groupMembershipInstances)
    groupMembersInstances.forEach(instance => elements.push(instance))
  }, 'Group members filter'),
})

export default filterCreator
