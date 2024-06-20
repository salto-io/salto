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
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, resolvePath } from '@salto-io/adapter-utils'
import { InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils, elements as elementsUtils } from '@salto-io/adapter-components'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  AUTHORIZATION_POLICY_RULE,
  GROUP_MEMBERSHIP_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  MFA_RULE_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME,
  USER_TYPE_NAME,
} from './constants'
import { DEFAULT_CONVERT_USERS_IDS_VALUE, OktaUserConfig } from './user_config'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

export const OMIT_MISSING_USERS_CONFIGURATION_LINK =
  'https://help.salto.io/en/articles/8817969-element-references-users-which-don-t-exist-in-target-environment-okta'
const USER_CHUNK_SIZE = 200

export type User = {
  id: string
  profile: {
    login: string
  }
}

type SearchProperty = 'id' | 'profile.login'

type SearchUsersParams = {
  userIds: string[]
  property: SearchProperty
}

const USER_SCHEMA = Joi.object({
  id: Joi.string().required(),
  profile: Joi.object({
    login: Joi.string().required(),
  }).unknown(true),
}).unknown(true)

const USERS_RESPONSE_SCHEMA = Joi.array().items(USER_SCHEMA).required()

export const areUsers = createSchemeGuard<User[]>(USERS_RESPONSE_SCHEMA, 'Received an invalid response for the users')

export const shouldConvertUserIds = (
  fetchQuery: elementsUtils.query.ElementQuery,
  userConfig: OktaUserConfig,
): boolean =>
  !fetchQuery.isTypeMatch(USER_TYPE_NAME) && (userConfig.fetch.convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)

const EXCLUDE_USERS_PATH = ['conditions', 'people', 'users', 'exclude']
const INCLUDE_USERS_PATH = ['conditions', 'people', 'users', 'include']

export const USER_MAPPING: Record<string, string[][]> = {
  [GROUP_RULE_TYPE_NAME]: [EXCLUDE_USERS_PATH],
  [ACCESS_POLICY_RULE_TYPE_NAME]: [EXCLUDE_USERS_PATH, INCLUDE_USERS_PATH],
  [PASSWORD_RULE_TYPE_NAME]: [EXCLUDE_USERS_PATH],
  [SIGN_ON_RULE_TYPE_NAME]: [EXCLUDE_USERS_PATH],
  [MFA_RULE_TYPE_NAME]: [EXCLUDE_USERS_PATH],
  [AUTHORIZATION_POLICY_RULE]: [INCLUDE_USERS_PATH],
  [GROUP_MEMBERSHIP_TYPE_NAME]: [['members']],
  EndUserSupport: [['technicalContactId']],
}

export const TYPES_WITH_USERS = new Set(Object.keys(USER_MAPPING))

export const getUsersFromInstances = (instances: InstanceElement[]): string[] =>
  _.uniq(
    instances
      .filter(instance => TYPES_WITH_USERS.has(instance.elemID.typeName))
      .flatMap(instance => {
        const userPaths = USER_MAPPING[instance.elemID.typeName]
        return userPaths.flatMap(path => resolvePath(instance, instance.elemID.createNestedID(...path)))
      })
      .filter(_.isString),
  )

const getUsersQuery = (userIds: string[], property: SearchProperty): string =>
  userIds.map(userId => `${property} eq "${userId}"`).join(' or ')

// the header omits credentials and other unnecessary fields from the response
export const OMIT_CREDS_HEADER = {
  'Content-Type': 'application/json; okta-response=omitCredentials,omitCredentialsLinks',
}

export const getUsers = async (
  paginator: clientUtils.Paginator,
  searchUsersParams?: SearchUsersParams,
): Promise<User[]> =>
  log.timeDebug(async () => {
    const paginationArgs = {
      url: '/api/v1/users',
      paginationField: 'after',
      headers: OMIT_CREDS_HEADER,
    }

    if (searchUsersParams) {
      log.debug('getUsers called with searchQuery strategy')
      const userChunks = _.chunk(searchUsersParams.userIds, USER_CHUNK_SIZE)
      const allUsers = (
        await Promise.all(
          userChunks.map(async userIdsChunk => {
            const usersQueryParam = { search: getUsersQuery(userIdsChunk, searchUsersParams.property) }
            _.set(paginationArgs, 'queryParams', usersQueryParam)
            const users = (
              await toArrayAsync(paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[]))
            ).flat()
            return users
          }),
        )
      ).flat()
      return areUsers(allUsers) ? allUsers : []
    }

    log.debug('getUsers called with allUsers strategy')
    const users = (
      await toArrayAsync(paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[]))
    ).flat()
    return areUsers(users) ? users : []
  }, 'getUsers function')
