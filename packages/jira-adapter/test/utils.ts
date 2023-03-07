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
import { InstanceElement, ElemID, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { adapter } from '../src/adapter_creator'
import { Credentials } from '../src/auth'
import { JiraConfig, configType, getDefaultConfig } from '../src/config/config'
import JiraClient from '../src/client/client'
import { FilterCreator } from '../src/filter'
import { paginate } from '../src/client/pagination'
import { GetUserMapFunc, getUserMapFuncCreator } from '../src/users'
import { JIRA } from '../src/constants'


export const createCredentialsInstance = (credentials: Credentials): InstanceElement => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.authenticationMethods.basic.credentialsType,
    credentials,
  )
)

export const createConfigInstance = (config: JiraConfig): InstanceElement => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.configType as ObjectType,
    config,
  )
)

const mockConnection = (): MockInterface<clientUtils.APIConnection> => ({
  get: mockFunction<clientUtils.APIConnection['get']>().mockResolvedValue({ status: 200, data: '' }),
  post: mockFunction<clientUtils.APIConnection['post']>().mockResolvedValue({ status: 200, data: '' }),
  put: mockFunction<clientUtils.APIConnection['put']>().mockResolvedValue({ status: 200, data: '' }),
  delete: mockFunction<clientUtils.APIConnection['delete']>().mockResolvedValue({ status: 200, data: '' }),
  patch: mockFunction<clientUtils.APIConnection['patch']>().mockResolvedValue({ status: 200, data: '' }),
})

type ClientWithMockConnection = {
  client: JiraClient
  paginator: clientUtils.Paginator
  connection: MockInterface<clientUtils.APIConnection>
  getUserMapFunc: GetUserMapFunc
}
export const mockClient = (isDataCenter = false): ClientWithMockConnection => {
  const connection = mockConnection()
  const client = new JiraClient({
    credentials: {
      baseUrl: 'https://ori-salto-test.atlassian.net/',
      user: 'test',
      token: 'test',
    },
    connection: {
      login: async () => ({
        accountId: 'test',
        ...connection,
      }),
    },
    isDataCenter,
  })
  const paginator = clientUtils.createPaginator(
    { paginationFuncCreator: paginate, client }
  )
  const getUserMapFunc = getUserMapFuncCreator(paginator, client.isDataCenter)
  return { client, paginator, connection, getUserMapFunc }
}

export const getDefaultAdapterConfig = async (): Promise<JiraConfig> => {
  const defaultConfigInstance = await createDefaultInstanceFromType('jira', configType)
  return defaultConfigInstance.value as JiraConfig
}

export const getFilterParams = (params?: Partial<Parameters<FilterCreator>[0]>, isDataCenter = false)
: Parameters<FilterCreator>[0] => ({
  ...mockClient(isDataCenter),
  config: getDefaultConfig({ isDataCenter }),
  elementsSource: buildElementsSourceFromElements([]),
  fetchQuery: elementUtils.query.createMockQuery(),
  adapterContext: {},
  ...params ?? {},
})

export const getAccountInfoInstance = (isFree: boolean): InstanceElement => (
  new InstanceElement(
    '_config',
    new ObjectType({
      elemID: new ElemID(JIRA, 'AccountInfo'),
    }),
    {
      license: {
        applications: [
          {
            id: 'jira-software',
            plan: isFree ? 'FREE' : 'BUSINESS',
          },
        ],
      },
    }
  )
)

export const getLicenseElementSource = (isFree: boolean): ReadOnlyElementsSource =>
  buildElementsSourceFromElements([getAccountInfoInstance(isFree)])

export const createEmptyType = (type: string): ObjectType => new ObjectType({
  elemID: new ElemID(JIRA, type),
})
