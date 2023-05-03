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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { paginate } from '../client/pagination'
import OktaClient from '../client/client'
import { OktaConfig, FETCH_CONFIG } from '../config'
import { USER_MAPPING, getUsers } from '../filters/user'

const { isDefined } = values
const { createPaginator } = clientUtils
const log = logger(module)

/**
* Verifies users exist in the environement before deployment of an instance with user references
*/
export const usersValidator: (client: OktaClient, config: OktaConfig) =>
    ChangeValidator = (client, config) => async changes => {
      if (!(config[FETCH_CONFIG]?.convertUsersIds ?? true)) {
        log.debug('Skipped usersValidator because convertUsersIds config flag is disabled')
        return []
      }
      const relevantInstances = changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => Object.keys(USER_MAPPING).includes(instance.elemID.typeName))

      if (_.isEmpty(relevantInstances)) {
        return []
      }

      const paginator = createPaginator({
        client,
        paginationFuncCreator: paginate,
      })

      const users = await getUsers(paginator)

      const existingUsers = new Set(users.map(user => user.profile.login))

      const missingUsersByInstanceId = Object.fromEntries(relevantInstances.map(instance => {
        const userPaths = USER_MAPPING[instance.elemID.typeName]
        const missingUsers = userPaths
          .flatMap(path => resolvePath(instance, instance.elemID.createNestedID(...path)))
          .filter(user => !existingUsers.has(user))
        if (!_.isEmpty(missingUsers)) {
          return [instance.elemID.getFullName(), missingUsers]
        }
        return undefined
      }).filter(isDefined))

      return relevantInstances
        .filter(instance => missingUsersByInstanceId[instance.elemID.getFullName()] !== undefined)
        .map(instance => ({
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Instance references users which don\'t exist in target environment',
          detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${missingUsersByInstanceId[instance.elemID.getFullName()].join(', ')}.\nIn order to deploy this instance, add these users to your target environment or edit this instance to use valid usernames.`,
        }))
    }
