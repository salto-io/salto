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
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { client as clientUtils, resolveValues } from '@salto-io/adapter-components'
import {
  getUsers,
  MISSING_USERS_DOC_LINK,
  MISSING_USERS_ERROR_MSG,
  TYPE_NAME_TO_REPLACER,
  User,
  VALID_USER_VALUES,
} from '../user_utils'
import { lookupFunc } from '../filters/field_references'
import { paginate } from '../client/pagination'
import ZendeskClient from '../client/client'
import { CUSTOM_ROLE_TYPE_NAME } from '../constants'
import { ZendeskFetchConfig } from '../config'

const { createPaginator } = clientUtils
const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

type userPathAndInstance = { user: string; userPath: ElemID; instance: InstanceElement }

const getDefaultMissingUsersError = (instance: InstanceElement, missingUsers: string[]): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: MISSING_USERS_ERROR_MSG,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

const handleNonExistingUsers = async (nonExistingUsersPaths: userPathAndInstance[]): Promise<ChangeError[]> => {
  // Group each instance with its missing users, to create one error per instance
  const instancesAndUsers = Object.values(
    _.groupBy(nonExistingUsersPaths, pathInstance => pathInstance.instance.elemID.getFullName()),
  ).map(paths => ({ instance: paths[0].instance, users: paths.map(path => path.user) }))

  // Error about users that do not exist because no fallback user was provided
  return instancesAndUsers.map(instanceAndUsers =>
    getDefaultMissingUsersError(instanceAndUsers.instance, instanceAndUsers.users),
  )
}

const handleExistingUsers = ({
  existingUsersPaths,
  customRolesById,
  usersByEmail,
}: {
  existingUsersPaths: userPathAndInstance[]
  customRolesById: Record<number, InstanceElement>
  usersByEmail: Record<string, User>
}): ChangeError[] => {
  const pathsWithoutPermissions = existingUsersPaths.filter(({ user, userPath, instance }) => {
    // The field is in the same nesting as the user value
    const fieldPath = userPath.createParentID().createNestedID('field')
    const field = resolvePath(instance, fieldPath)
    // Currently it seems that only assignee_id requires special permissions
    if (field !== 'assignee_id') {
      return false
    }
    const userCustomRoleId = usersByEmail[user].custom_role_id
    const customRole = _.isNumber(userCustomRoleId) ? customRolesById[userCustomRoleId] : undefined
    // ticket_editing permission is required to be an assignee
    return customRole !== undefined && customRole.value.configuration?.ticket_editing === false
  })
  const pathsByInstance = _.groupBy(pathsWithoutPermissions, pathInstance => pathInstance.instance.elemID.getFullName())
  return Object.values(pathsByInstance).map(paths => ({
    elemID: paths[0].instance.elemID,
    severity: 'Warning',
    message: 'Some users do not have the required permissions to be set as assignees',
    detailedMessage: `The users ${paths.map(path => path.user).join(', ')} cannot be set as assignees because they don't have the ticket editing permission.`,
  }))
}

/**
 * Verifies users exist and have permissions before deployment of an instance with user references
 * This validator assumes the defaultMissingUserFallback has already been updated for the relevant users.
 * Change error will vary based on the following scenarios:
 *  1. If we could not use user fallback value for some reason, we will return an error.
 *  2. If the user has no permissions to its field, we will return a warning (default user included).
 */
export const usersValidator: (client: ZendeskClient, fetchConfig: ZendeskFetchConfig) => ChangeValidator =
  (client, fetchConfig) => async (changes, elementSource) => {
    const relevantInstances = await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => Object.keys(TYPE_NAME_TO_REPLACER).includes(instance.elemID.typeName))
      .map(data => resolveValues(data, lookupFunc))
      .toArray()

    if (relevantInstances.length === 0) {
      return []
    }

    const paginator = createPaginator({
      client,
      paginationFuncCreator: paginate,
    })
    const { users } = await getUsers(paginator, fetchConfig.resolveUserIDs)

    const existingUsersEmails = new Set(users.map(user => user.email))
    const instancesUserPaths = relevantInstances.flatMap(instance => {
      const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
      return userPaths
        .map(userPath => {
          const user = resolvePath(instance, userPath)
          // Filter our valid values that are not users
          return VALID_USER_VALUES.includes(user) ? undefined : { user, userPath, instance }
        })
        .filter(isDefined)
    })

    const [existingUsersPaths, nonExistingUsersPaths] = _.partition(instancesUserPaths, userPath =>
      existingUsersEmails.has(userPath.user),
    )

    const notExistingUsersErrors = await handleNonExistingUsers(nonExistingUsersPaths)

    if (elementSource === undefined) {
      log.error('Failed to handleExistingUsers in userPermissionsValidator because no element source was provided')
      return notExistingUsersErrors
    }

    // Don't waste time fetching the elements if there are no existing users to check
    if (existingUsersPaths.length === 0) {
      return notExistingUsersErrors
    }

    const elements = await elementSource.getAll()
    const customRoles = await awu(elements)
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === CUSTOM_ROLE_TYPE_NAME)
      .toArray()

    const usersByEmail = _.keyBy(users, user => user.email)
    const customRolesById = _.keyBy(customRoles, (role): number => role.value.id)

    const existingUsersWarnings = handleExistingUsers({ existingUsersPaths, customRolesById, usersByEmail })

    return [...notExistingUsersErrors, ...existingUsersWarnings]
  }
