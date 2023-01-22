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
import _ from 'lodash'
import { resolvePath, resolveValues } from '@salto-io/adapter-utils'
import { ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { getUsers, TYPE_NAME_TO_REPLACER } from '../user_utils'
import { paginate } from '../client/pagination'
import ZendeskClient from '../client/client'
import { lookupFunc } from '../filters/field_references'


const { awu } = collections.asynciterable
const { createPaginator } = clientUtils
// system options that does not contain a specific user value
const VALID_USER_VALUES = ['current_user', 'all_agents', 'requester_id', 'assignee_id', 'requester_and_ccs']

const getMissingUsers = (instance: InstanceElement, existingUsers: Set<string>): string[] => {
  const userPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
  const missingUsers = userPaths
    .map(path => resolvePath(instance, path))
    .filter(userValue => !VALID_USER_VALUES.includes(userValue))
    .filter(userValue => !existingUsers.has(userValue))
  return _.uniq(missingUsers)
}

/**
 * Verifies users exists before deployment of an element with user fields
 */
export const missingUsersValidator: (client: ZendeskClient) =>
  ChangeValidator = client => async changes => {
    const relevantInstances = await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => Object.keys(TYPE_NAME_TO_REPLACER).includes(instance.elemID.typeName))
      .map(data => resolveValues(data, lookupFunc))
      .toArray()

    if (_.isEmpty(relevantInstances)) {
      return []
    }

    const paginator = createPaginator({
      client,
      paginationFuncCreator: paginate,
    })
    const usersEmails = new Set((await getUsers(paginator)).map(user => user.email))

    return relevantInstances
      .flatMap(instance => {
        const missingUsers = getMissingUsers(instance, usersEmails)
        if (_.isEmpty(missingUsers)) {
          return []
        }
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `${missingUsers.length} references to users that don't exist in the target environment.`,
          detailedMessage: `The following users don't exist in the target environment: ${missingUsers.join(', ')}.\nPlease manually edit the element and set existing user emails or add users with this emails to the target environment.`,
        }]
      })
  }
