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
import { ADAPTER_NAME, USER_TYPE_NAME } from './constants'
import { USERS_PAGE_SIZE } from './definitions/requests/pagination'

const log = logger(module)

type User = {
  accountId: string
  displayName?: string
}

const USER_SCHEMA = Joi.object({
  accountId: Joi.string().required(),
  displayName: Joi.string(),
})
  .unknown(true)
  .required()

const isUser = createSchemeGuard<User>(USER_SCHEMA)

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
  [USER_TYPE_NAME]: USERS_FETCH_DEF,
}

export const getUsersIndex = async (
  definitions: definitionsUtils.ApiDefinitions<Options>,
): Promise<Record<string, User>> => {
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
  try {
    const result = await requester.requestAllForResource({
      callerIdentifier: { typeName: USER_TYPE_NAME },
      contextPossibleArgs: {},
    })
    return _.keyBy(result.map(item => item.value).filter(isUser), 'accountId')
  } catch (e) {
    log.error('Failed to fetch users with error %o', e)
    return {}
  }
}
