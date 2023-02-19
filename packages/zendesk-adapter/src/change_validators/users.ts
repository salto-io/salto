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

import {
  ChangeError,
  ChangeValidator, ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange, isInstanceElement,
} from '@salto-io/adapter-api'
import { resolvePath, resolveValues } from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { getUserFallbackValue, getUsers, TYPE_NAME_TO_REPLACER, User, VALID_USER_VALUES } from '../user_utils'
import { lookupFunc } from '../filters/field_references'
import { paginate } from '../client/pagination'
import ZendeskClient from '../client/client'
import { ZedneskDeployConfig } from '../config'
import { CUSTOM_ROLE_TYPE_NAME } from '../constants'

const { createPaginator } = clientUtils
const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

type userPathAndInstance = { user: string; userPath: ElemID; instance: InstanceElement }

const MISSING_USERS_DOC_LINK = 'https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk'
const MISSING_USERS_ERROR_MSG = 'Instance references users which don\'t exist in target environment'

export const getDefaultMissingUsersError = (
  instance: InstanceElement,
  missingUsers: string[],
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: MISSING_USERS_ERROR_MSG,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

export const getMissingUsersChangeWarning = (
  instance: InstanceElement,
  missingUsers: string[],
  userFallbackValue: string
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `${missingUsers.length} usernames will be overridden to ${userFallbackValue}`,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIf you continue, they will be set to ${userFallbackValue} according to the environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

export const getFallbackUserIsMissingError = (
  instance: InstanceElement,
  missingUsers: string[],
  userFallbackValue: string
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: MISSING_USERS_ERROR_MSG,
  detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsers.join(', ')}.\nIn addition, we could not get the defined fallback user ${userFallbackValue}. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: ${MISSING_USERS_DOC_LINK}`,
})

const handleNonExistingUsers = async ({ missingUserFallback, existingUsersEmails, client, nonExistingUsersPaths } : {
    missingUserFallback: string | undefined
    existingUsersEmails: Set<string>
    client: ZendeskClient
    nonExistingUsersPaths: userPathAndInstance[]
}): Promise<{ defaultUserPaths?: userPathAndInstance[]; notExistingUsersErrors?: ChangeError[] }> => {
  // Group each instance with its missing users, to create one error per instance
  const instancesAndUsers = Object.values(
    _.groupBy(nonExistingUsersPaths, pathInstance => pathInstance.instance.elemID.getFullName())
  ).map(paths => ({ instance: paths[0].instance, users: paths.map(path => path.user) }))

  if (missingUserFallback !== undefined) {
    const fallbackValue = await getUserFallbackValue(missingUserFallback, existingUsersEmails, client)
    if (fallbackValue !== undefined) {
      // Warn about users that do not exist because they will be replaced by the fallback user
      // return the paths with, now with the fallback user that is going to be used
      return {
        notExistingUsersErrors: instancesAndUsers.map(instanceAndUsers =>
          getMissingUsersChangeWarning(instanceAndUsers.instance, instanceAndUsers.users, fallbackValue)),
        defaultUserPaths: nonExistingUsersPaths.map(path => ({ ...path, user: fallbackValue })),
      }
    }
    // Error about users that do not exist because the chosen fallback user is missing
    return {
      notExistingUsersErrors: instancesAndUsers.map(instanceAndUsers =>
        getFallbackUserIsMissingError(instanceAndUsers.instance, instanceAndUsers.users, missingUserFallback)),
    }
  }
  // Error about users that do not exist because no fallback user was provided
  return {
    notExistingUsersErrors: instancesAndUsers.map(instanceAndUsers =>
      getDefaultMissingUsersError(instanceAndUsers.instance, instanceAndUsers.users)),
  }
}

const handleExistingUsers = ({ existingUsersPaths, customRolesById, usersByEmail } : {
    existingUsersPaths: userPathAndInstance[]
    customRolesById: Record<number, InstanceElement>
    usersByEmail: Record<string, User>
}): ChangeError[] => {
  const pathsWithoutPermissions = existingUsersPaths.filter(({ user, userPath, instance }) => {
    // The field is in the same nesting as the user value
    const fieldPath = userPath.createBaseID().path.slice(0, -1).concat('field')
    const field = _.get(instance.value, fieldPath)
    // Currently it seems that only assignee_id requires special permissions
    if (field !== 'assignee_id') {
      return false
    }
    const userCustomRoleId = usersByEmail[user].custom_role_id
    const customRole = customRolesById[userCustomRoleId]
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
 * Change error will vary based on the following scenarios:
 *  1. If the config option 'defaultMissingUserFallback' exists, we will warn the user about missing users changes.
 *  2. If 'defaultMissingUserFallback' isn't defined, or if we could not use user fallback value for some reason,
 *     we will return an error.
 *  3. If the user has no permissions to its field, we will return a warning (default user included).
 */
export const usersValidator: (client: ZendeskClient, deployConfig?: ZedneskDeployConfig) =>
    ChangeValidator = (client, deployConfig) =>
      async (changes, elementSource) => {
        if (elementSource === undefined) {
          log.error('Failed to run userPermissionsValidator because no element source was provided')
          return []
        }

        const relevantInstances = await awu(changes).filter(isAdditionOrModificationChange).filter(isInstanceChange)
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
        const existingUsersEmails = new Set((await getUsers(paginator)).map(user => user.email))
        const instancesUserPaths = relevantInstances.flatMap(instance => {
          const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
          return userPaths.map(userPath => {
            const user = resolvePath(instance, userPath)
            // Filter our valid values that are not users
            return VALID_USER_VALUES.includes(user)
              ? undefined
              : { user: resolvePath(instance, userPath), userPath, instance }
          }).filter(isDefined)
        })

        const [existingUsersPaths, nonExistingUsersPaths] = _.partition(instancesUserPaths,
          userPath => existingUsersEmails.has(userPath.user))

        const { notExistingUsersErrors = [], defaultUserPaths = [] } = await handleNonExistingUsers({
          missingUserFallback: deployConfig?.defaultMissingUserFallback,
          existingUsersEmails,
          client,
          nonExistingUsersPaths,
        })

        // Non-existing users were replaced by the default user are handled as existing users
        const updatedExistingUsersPaths = [...existingUsersPaths, ...defaultUserPaths]

        // Don't waste time fetching the elements if there are no existing users to check
        const elements = updatedExistingUsersPaths.length > 0 ? await elementSource.getAll() : []
        const customRoles = await awu(elements).filter(isInstanceElement)
          .filter(e => e.elemID.typeName === CUSTOM_ROLE_TYPE_NAME).toArray()

        const usersByEmail = _.keyBy(await getUsers(paginator), user => user.email)
        const customRolesById = _.keyBy(customRoles, (role): number => role.value.id)

        const existingUsersWarnings = handleExistingUsers(
          { existingUsersPaths: updatedExistingUsersPaths, customRolesById, usersByEmail }
        )

        return [...notExistingUsersErrors, ...existingUsersWarnings]
      }
