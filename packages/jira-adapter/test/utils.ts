/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { adapter } from '../src/adapter_creator'
import { Credentials } from '../src/auth'
import { JiraConfig, configType } from '../src/config'
import JiraClient from '../src/client/client'


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
}
export const mockClient = (): ClientWithMockConnection => {
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
  })
  const paginator = clientUtils.createPaginator(
    { paginationFuncCreator: clientUtils.getWithOffsetAndLimit, client }
  )
  return { client, paginator, connection }
}

export const getDefaultAdapterConfig = async (): Promise<JiraConfig> => {
  const defaultConfigInstance = await createDefaultInstanceFromType('jira', configType)
  return defaultConfigInstance.value as JiraConfig
}
