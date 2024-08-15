/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import {
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  getChangeData,
  AdditionChange,
  ModificationChange,
  isAdditionChange,
  SaltoElementError,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify, applyFunctionToChangeData, getParents } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_MEMBERSHIP_TYPE_NAME } from '../constants'
import { FETCH_CONFIG } from '../config'

const log = logger(module)
const { isDefined } = values

type GroupMembershipInstance = InstanceElement & {
  value: {
    members: string[]
  }
}

type GroupMembershipDeployResult = {
  appliedChange?: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
  error?: SaltoElementError
}

export const isValidGroupMembershipInstance = (instance: InstanceElement): instance is GroupMembershipInstance =>
  Array.isArray(instance.value.members) && instance.value.members.every(m => _.isString(m))

const deployGroupAssignment = async ({
  groupId,
  userId,
  action,
  client,
}: {
  groupId: string
  userId: string
  action: 'add' | 'remove'
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface
}): Promise<{ userId: string; result: 'success' | 'failure' }> => {
  const endpoint = `/api/v1/groups/${groupId}/users/${userId}`
  try {
    await client[action === 'add' ? 'put' : 'delete']({
      url: endpoint,
      data: undefined,
    })
    return { userId, result: 'success' }
  } catch (err) {
    log.error(
      'Failed to deploy group assignment for user %s to group %s with error: %s',
      userId,
      groupId,
      safeJsonStringify(err),
    )
    return { userId, result: 'failure' }
  }
}

const updateChangeWithFailedAssignments = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  failedAdditions: string[],
  failedRemovals?: string[],
): Promise<AdditionChange<InstanceElement> | ModificationChange<InstanceElement>> => {
  const updatedChange = await applyFunctionToChangeData(change, async inst => {
    const updatedMembers = (inst.value.members as string[])
      .filter(m => !failedAdditions.some(failedId => failedId === m))
      .concat(failedRemovals ?? [])
    inst.value.members = updatedMembers
    return inst
  })
  return updatedChange
}

const deployGroupMembershipChange = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<GroupMembershipDeployResult> => {
  const parentGroupId = getParents(getChangeData(change))[0]?.id // parent is already resolved
  if (!_.isString(parentGroupId)) {
    log.error(
      'Failed to deploy group membership for change %s because parent group id for group is missing: %s',
      getChangeData(change).elemID.getFullName(),
      safeJsonStringify(getChangeData(change)),
    )
    return { error: { elemID: getChangeData(change).elemID, severity: 'Error', message: 'Failed to get group ID' } }
  }

  if (isAdditionChange(change)) {
    const instance = getChangeData(change)
    if (!isValidGroupMembershipInstance(instance)) {
      return {
        error: {
          elemID: getChangeData(change).elemID,
          severity: 'Error',
          message: 'Invalid group membership instance',
        },
      }
    }
    const res = await Promise.all(
      instance.value.members.map(async member =>
        deployGroupAssignment({ groupId: parentGroupId, userId: member, action: 'add', client }),
      ),
    )
    const failedAssignments = res.filter(({ result }) => result === 'failure').map(({ userId }) => userId)
    log.error('failed to add the following group assignments: %s', failedAssignments.join(', '))

    return { appliedChange: await updateChangeWithFailedAssignments(change, failedAssignments) }
  }

  const [before, after] = [change.data.before, change.data.after]
  if (!isValidGroupMembershipInstance(before) || !isValidGroupMembershipInstance(after)) {
    return {
      error: { elemID: getChangeData(change).elemID, severity: 'Error', message: 'Invalid group membership instance' },
    }
  }
  const [membersBefore, membersAfter] = [before.value.members, after.value.members]
  const [membersBeforeSet, membersAfterSet] = [new Set(membersBefore), new Set(membersAfter)]

  const additions = membersAfter.filter(member => !membersBeforeSet.has(member))
  const removals = membersBefore.filter(member => !membersAfterSet.has(member))
  const additionsResult = await Promise.all(
    additions.map(member => deployGroupAssignment({ groupId: parentGroupId, userId: member, action: 'add', client })),
  )
  const failedAdditions = additionsResult.filter(({ result }) => result === 'failure').map(({ userId }) => userId)
  log.error('failed to add the following group assignments: %s', failedAdditions.join(', '))

  const removalResult = await Promise.all(
    removals.map(member => deployGroupAssignment({ groupId: parentGroupId, userId: member, action: 'remove', client })),
  )
  const failedRemovals = removalResult.filter(({ result }) => result === 'failure').map(({ userId }) => userId)
  log.error('failed to remove the following group assignments: %s', failedRemovals.join(', '))

  return { appliedChange: await updateChangeWithFailedAssignments(change, failedAdditions, failedRemovals) }
}

/**
 * Deploy GroupMembership by adding or removing users from groups
 */
const groupMembersFilter: FilterCreator = ({ definitions, config }) => ({
  name: 'groupMembersFilter',
  deploy: async changes => {
    const client = definitions.clients.options.main.httpClient
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionOrModificationChange(change) &&
        getChangeData(change).elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME,
    )

    const { includeGroupMemberships } = config[FETCH_CONFIG]
    if (!includeGroupMemberships && relevantChanges.length > 0) {
      log.error('group memberships flag is disabled')
      return {
        leftoverChanges,
        deployResult: {
          appliedChanges: [],
          errors: relevantChanges.map(change => ({
            elemID: getChangeData(change).elemID,
            severity: 'Error',
            message:
              'Group membership is disabled. To apply this change, change fetch.includeGroupMemberships flag to “true” in your Okta environment configuration.',
          })),
        },
      }
    }
    const deployResult = await Promise.all(
      relevantChanges
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(async change => deployGroupMembershipChange(change, client)),
    )

    return {
      leftoverChanges,
      deployResult: {
        appliedChanges: deployResult.map(({ appliedChange }) => appliedChange).filter(isDefined),
        errors: deployResult.map(({ error }) => error).filter(isDefined),
      },
    }
  },
})

export default groupMembersFilter
