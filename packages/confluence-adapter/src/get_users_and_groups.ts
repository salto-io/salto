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

import { createSchemeGuard } from '@salto-io/adapter-utils'
import { fetch as fetchUtils, definitions as definitionsUtils } from '@salto-io/adapter-components'
import Joi from 'joi'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Options } from './definitions/types'
import { ADAPTER_NAME, GROUP_TYPE_NAME, USER_TYPE_NAME } from './constants'
import { USERS_PAGE_SIZE } from './definitions/requests/pagination'

const log = logger(module)

type User = {
  accountId: string
  displayName?: string
}

type Group = {
  name: string
  id: string
}

const USER_SCHEMA = Joi.object({
  accountId: Joi.string().required(),
  displayName: Joi.string(),
})
  .unknown(true)
  .required()

const GROUP_SCHEMA = Joi.object({
  name: Joi.string().required(),
  id: Joi.string().required(),
})
  .unknown(true)
  .required()

const isUser = createSchemeGuard<User>(USER_SCHEMA)
const isGroup = createSchemeGuard<Group>(GROUP_SCHEMA)

const GROUP_FETCH_DEF: definitionsUtils.fetch.InstanceFetchApiDefinitions<Options> = {
  requests: [
    {
      endpoint: {
        method: 'get',
        path: '/wiki/rest/api/group',
      },
      transformation: {
        root: 'results',
        pick: ['name', 'id'],
      },
    },
  ],
}

const USERS_FETCH_DEF: definitionsUtils.fetch.InstanceFetchApiDefinitions<Options> = {
  requests: [
    {
      endpoint: {
        client: 'users_client',
        method: 'get',
        path: '/rest/api/3/users/search',
        queryArgs: {
          maxResults: USERS_PAGE_SIZE,
        },
      },
      transformation: {
        pick: ['accountId', 'displayName'],
      },
    },
  ],
}

const CUSTOMIZATION_DEF: Record<string, definitionsUtils.fetch.InstanceFetchApiDefinitions<Options>> = {
  [GROUP_TYPE_NAME]: GROUP_FETCH_DEF,
  [USER_TYPE_NAME]: USERS_FETCH_DEF,
}

export const getUsersAndGroups = async (
  definitions: definitionsUtils.ApiDefinitions<Options>,
): Promise<{ usersIndex: Record<string, User>; groupsIndex: Record<string, Group> }> => {
  const { fetch } = definitions
  if (fetch === undefined) {
    throw new Error('could not find fetch definitions')
  }
  const definitionsWithFetch = { fetch, ...definitions }
  const requester = fetchUtils.request.getRequester<Options>({
    adapterName: ADAPTER_NAME,
    clients: definitionsWithFetch.clients,
    pagination: definitionsWithFetch.pagination,
    requestDefQuery: definitionsUtils.queryWithDefault(
      definitionsUtils.getNestedWithDefault(
        {
          ...definitionsWithFetch.fetch.instances,
          customizations: CUSTOMIZATION_DEF,
        },
        'requests',
      ),
    ),
  })

  const callSingleResource = async <T>(
    typeName: string,
    filterFn: (item: unknown) => item is T,
    idKey: string,
  ): Promise<Record<string, T>> => {
    try {
      const result = await requester.requestAllForResource({
        callerIdentifier: { typeName },
        contextPossibleArgs: {},
      })
      return _.keyBy(result.map(item => item.value).filter(filterFn), idKey)
    } catch (e) {
      log.error(`Failed to fetch ${typeName.toLowerCase()}s with error %o`, e)
      return {}
    }
  }
  const [groupsIndex, usersIndex] = await Promise.all([
    callSingleResource<Group>(GROUP_TYPE_NAME, isGroup, 'id'),
    callSingleResource<User>(USER_TYPE_NAME, isUser, 'accountId'),
  ])
  return { groupsIndex, usersIndex }
}
