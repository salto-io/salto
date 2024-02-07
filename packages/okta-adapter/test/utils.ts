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
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG, OktaConfig } from '../src/config'
import { adapter } from '../src/adapter_creator'
import OktaClient from '../src/client/client'
import { paginate } from '../src/client/pagination'
import { FilterCreator } from '../src/filter'
import { Credentials } from '../src/auth'


export const createCredentialsInstance = (credentials: Credentials): InstanceElement => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.authenticationMethods.basic.credentialsType,
    credentials,
  )
)

export const createConfigInstance = (config: OktaConfig): InstanceElement => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.configType as ObjectType,
    config,
  )
)

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
  const paginator = clientUtils.createPaginator(
    { paginationFuncCreator: paginate, client }
  )
  return { client, paginator, connection }
}

export const getFilterParams = (params?: Partial<Parameters<FilterCreator>[0]>)
: Parameters<FilterCreator>[0] => ({
  ...mockClient(),
  config: DEFAULT_CONFIG,
  elementsSource: buildElementsSourceFromElements([]),
  fetchQuery: elementUtils.query.createMockQuery(),
  adapterContext: {},
  ...params ?? {},
})
