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
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import Joi from 'joi'
import _ from 'lodash'
import ZendeskClient from '../client/client'
import { GROUP_TYPE_NAME } from '../constants'

const log = logger(module)

const API_ERROR_MESSAGE = 'Changing the default group is not supported via the Zendesk API'

const defaultGroupAdditionError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot add a new default group',
  detailedMessage: `${API_ERROR_MESSAGE}, once deployed, you will need to set the group as default directly via Zendesk and fetch`,
})

const defaultGroupRemovalError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot delete the default group',
  detailedMessage: `This group (${group.elemID.name}) is currently set as default in Zendesk and therefore cannot be deleted.
${API_ERROR_MESSAGE}, therefore, you will need to configure a new default group directly via Zendesk and fetch.`,
})

const defaultGroupModificationError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot change the default group',
  detailedMessage: `${API_ERROR_MESSAGE}, therefore, you will need to do it directly via Zendesk and fetch.`,
})

const EXPECTED_GROUP_MEMBERSHIP_RESPONSE_SCHEMA = Joi.object({
  group_memberships: Joi.array()
    .items(
      Joi.object({
        default: Joi.boolean().required(),
        user_id: Joi.number().required(),
      }).unknown(),
    )
    .required(),
}).unknown()

// eslint-disable-next-line camelcase
const groupMembershipSchema = createSchemeGuard<{ group_memberships: { user_id: string; default: boolean }[] }>(
  EXPECTED_GROUP_MEMBERSHIP_RESPONSE_SCHEMA,
  'Invalid group membership response',
)

/**
 * Fetches the group membership of the given groups,
 * and returns an error for each group that is a default group for a user.
 */
const fetchDefaultGroupMembershipRemovals = async (
  client: ZendeskClient,
  groups: InstanceElement[],
): Promise<ChangeError[]> => {
  const errorsWithUndefined = await Promise.all(
    groups.map(async group => {
      const response = await client.get({ url: `/api/v2/groups/${group.value.id}/memberships` })
      if (!groupMembershipSchema(response.data)) {
        log.warn(
          `Got an invalid response for group membership for group ${group.value.id}, skipping this validation. Response: ${safeJsonStringify(response.data)}`,
        )
        return undefined
      }
      const groupMemberships = response.data.group_memberships
      const usersWithDefaultGroup = groupMemberships.filter(membership => membership.default === true)
      if (usersWithDefaultGroup.length > 0) {
        return {
          elemID: group.elemID,
          severity: 'Error' as const,
          message: 'Cannot remove the group, it is set as default for some users',
          detailedMessage: `This group (${group.elemID.name}) is currently set as default for the following user ids: ${usersWithDefaultGroup.map(user => user.user_id).join(', ')}.`,
        }
      }
      return undefined
    }),
  )
  return errorsWithUndefined.filter(values.isDefined)
}

/**
 * Validates that the default group was not changed, and tell the user what to do.
 * Also validates if the group is a default group for a user and it was removed, and if so, returns an error.
 */
export const defaultGroupChangeValidator: (client: ZendeskClient) => ChangeValidator = client => async changes => {
  const groupChanges = changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_TYPE_NAME)

  const defaultGroupAddition = groupChanges
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(group => group.value.default === true)
  const [defaultGroupRemoval, nonDefaultGroupRemoval] = _.partition(
    groupChanges.filter(isRemovalChange).map(getChangeData),
    group => group.value.default === true,
  )
  const defaultGroupMembershipRemoval = await fetchDefaultGroupMembershipRemovals(client, nonDefaultGroupRemoval)
  const defaultGroupModification = groupChanges
    .filter(isModificationChange)
    .filter(change => change.data.before.value.default !== change.data.after.value.default)
    .map(getChangeData)

  return [
    defaultGroupAddition.map(defaultGroupAdditionError),
    defaultGroupRemoval.map(defaultGroupRemovalError),
    defaultGroupModification.map(defaultGroupModificationError),
    defaultGroupMembershipRemoval,
  ].flat()
}
