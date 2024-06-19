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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  client as clientUtils,
  elements as elementUtils,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { adapter } from '../src/adapter_creator'
import OktaClient from '../src/client/client'
import { paginate } from '../src/client/pagination'
import { FilterCreator } from '../src/filter'
import { Credentials } from '../src/auth'
import { DEFAULT_CONFIG, OktaUserConfig } from '../src/user_config'
import { OLD_API_DEFINITIONS_CONFIG } from '../src/config'
import { OktaFetchOptions } from '../src/definitions/types'
import { createClientDefinitions } from '../src/definitions/requests/clients'
import { PAGINATION } from '../src/definitions/requests/pagination'
import { createFetchDefinitions } from '../src/definitions/fetch/fetch'
import { getAdminUrl } from '../src/client/admin'
import fetchCriteria from '../src/fetch_criteria'

export const createCredentialsInstance = (credentials: Credentials): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.authenticationMethods.basic.credentialsType, credentials)

export const createConfigInstance = (config: OktaUserConfig): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, config)

const mockConnection = (): MockInterface<clientUtils.APIConnection> => ({
  get: mockFunction<clientUtils.APIConnection['get']>().mockResolvedValue({ status: 200, data: '' }),
  head: mockFunction<clientUtils.APIConnection['head']>().mockResolvedValue({ status: 200, data: '' }),
  options: mockFunction<clientUtils.APIConnection['options']>().mockResolvedValue({ status: 200, data: '' }),
  post: mockFunction<clientUtils.APIConnection['post']>().mockResolvedValue({ status: 200, data: '' }),
  put: mockFunction<clientUtils.APIConnection['put']>().mockResolvedValue({ status: 200, data: '' }),
  delete: mockFunction<clientUtils.APIConnection['delete']>().mockResolvedValue({ status: 200, data: '' }),
  patch: mockFunction<clientUtils.APIConnection['patch']>().mockResolvedValue({ status: 200, data: '' }),
})

type ClientWithMockConnection = {
  client: OktaClient
  paginator: clientUtils.Paginator
  connection: MockInterface<clientUtils.APIConnection>
}
export const mockClient = (): ClientWithMockConnection => {
  const connection = mockConnection()
  const client = new OktaClient({
    credentials: {
      baseUrl: 'https://dev-00000000.okta.com',
      token: 'test',
    },
    connection: {
      login: async () => ({
        ...connection,
        accountInfo: {
          accountId: 'test',
        },
      }),
    },
  })
  const paginator = clientUtils.createPaginator({ paginationFuncCreator: paginate, client })
  return { client, paginator, connection }
}

export const createDefinitions = ({
  client,
  usePrivateAPI = true,
}: {
  client?: OktaClient
  usePrivateAPI?: boolean
}): definitionsUtils.RequiredDefinitions<OktaFetchOptions> => {
  const cli = client ?? mockClient().client
  return {
    clients: createClientDefinitions({ main: cli, private: cli }),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(DEFAULT_CONFIG, usePrivateAPI, getAdminUrl(cli.baseUrl)),
  }
}

export const createFetchQuery = (config?: OktaUserConfig): elementUtils.query.ElementQuery =>
  elementUtils.query.createElementQuery(config?.fetch ?? DEFAULT_CONFIG?.fetch, fetchCriteria)

export const getFilterParams = (params?: Partial<Parameters<FilterCreator>[0]>): Parameters<FilterCreator>[0] => ({
  paginator: mockClient().paginator,
  definitions: createDefinitions({}),
  config: DEFAULT_CONFIG,
  elementSource: buildElementsSourceFromElements([]),
  fetchQuery: createFetchQuery(params?.config),
  oldApiDefinitions: OLD_API_DEFINITIONS_CONFIG,
  baseUrl: 'https://dev-00000000.okta.com',
  isOAuthLogin: false,
  sharedContext: {},
  ...(params ?? {}),
})
