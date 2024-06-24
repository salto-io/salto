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
import { InstanceElement, ElemID, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { adapter } from '../src/adapter_creator'
import { Credentials } from '../src/auth'
import { JiraConfig, configType, getDefaultConfig } from '../src/config/config'
import JiraClient from '../src/client/client'
import { EXTENSION_ID_ARI_PREFIX } from '../src/common/extensions'
import { FilterCreator } from '../src/filter'
import { paginate } from '../src/client/pagination'
import { GetUserMapFunc, getUserMapFuncCreator } from '../src/users'
import { JIRA, WORKFLOW_CONFIGURATION_TYPE } from '../src/constants'
import ScriptRunnerClient from '../src/client/script_runner_client'
import {
  WorkflowV2TransitionConditionGroup,
  WorkflowV2Transition,
  WorkflowV2TransitionRule,
} from '../src/filters/workflowV2/types'

export const createCredentialsInstance = (credentials: Credentials): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.authenticationMethods.basic.credentialsType, credentials)

export const createConfigInstance = (config: JiraConfig): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, config)

export const DEFAULT_CLOUD_ID = 'cloudId'
export const DEFAULT_RESPONSE = { status: 200, data: '' }
const mockConnection = (): MockInterface<clientUtils.APIConnection> => ({
  get: mockFunction<clientUtils.APIConnection['get']>().mockResolvedValue(DEFAULT_RESPONSE),
  head: mockFunction<clientUtils.APIConnection['head']>().mockResolvedValue(DEFAULT_RESPONSE),
  options: mockFunction<clientUtils.APIConnection['options']>().mockResolvedValue(DEFAULT_RESPONSE),
  post: mockFunction<clientUtils.APIConnection['post']>().mockResolvedValue(DEFAULT_RESPONSE),
  put: mockFunction<clientUtils.APIConnection['put']>().mockResolvedValue(DEFAULT_RESPONSE),
  delete: mockFunction<clientUtils.APIConnection['delete']>().mockResolvedValue(DEFAULT_RESPONSE),
  patch: mockFunction<clientUtils.APIConnection['patch']>().mockResolvedValue(DEFAULT_RESPONSE),
})

type ClientWithMockConnection = {
  client: JiraClient
  paginator: clientUtils.Paginator
  connection: MockInterface<clientUtils.APIConnection>
  getUserMapFunc: GetUserMapFunc
  scriptRunnerClient: ScriptRunnerClient
}
export const mockClient = (isDataCenter = false, cloudId?: string): ClientWithMockConnection => {
  const connection = mockConnection()
  const client = new JiraClient({
    credentials: {
      baseUrl: 'https://ori-salto-test.atlassian.net/',
      user: 'test',
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
    isDataCenter,
  })
  if (cloudId !== undefined) {
    client.getCloudId = async () => cloudId
  }

  const paginator = clientUtils.createPaginator({ paginationFuncCreator: paginate, client })
  const getUserMapFunc = getUserMapFuncCreator(paginator, client.isDataCenter)
  const scriptRunnerClient = new ScriptRunnerClient({
    credentials: {},
    isDataCenter,
    jiraClient: client,
  })

  return { client, paginator, connection, getUserMapFunc, scriptRunnerClient }
}

export const getDefaultAdapterConfig = async (): Promise<JiraConfig> => {
  const defaultConfigInstance = await createDefaultInstanceFromType('jira', configType)
  return defaultConfigInstance.value as JiraConfig
}

export const getFilterParams = (
  params?: Partial<Parameters<FilterCreator>[0]>,
  isDataCenter = false,
): Parameters<FilterCreator>[0] => ({
  ...mockClient(isDataCenter),
  config: getDefaultConfig({ isDataCenter }),
  elementsSource: buildElementsSourceFromElements([]),
  fetchQuery: elementUtils.query.createMockQuery(),
  adapterContext: {},
  ...(params ?? {}),
})

export const getAccountInfoInstance = (isFree: boolean): InstanceElement =>
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
    },
  )

export const getLicenseElementSource = (isFree: boolean): ReadOnlyElementsSource =>
  buildElementsSourceFromElements([getAccountInfoInstance(isFree)])

export const createEmptyType = (type: string): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, type),
  })

export const createSkeletonWorkflowV2TransitionConditionGroup = (): WorkflowV2TransitionConditionGroup => ({
  operation: 'ALL',
  conditions: [],
  conditionGroups: [],
})

export const createSkeletonWorkflowV2Transition = (name: string): WorkflowV2Transition => ({
  name,
  type: 'DIRECTED',
  conditions: createSkeletonWorkflowV2TransitionConditionGroup(),
  actions: [],
  validators: [],
})

export const createSkeletonWorkflowV2Instance = (name: string): InstanceElement =>
  new InstanceElement(name, createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
    name,
    scope: {
      project: 'project',
      type: 'type',
    },
    transitions: {
      transition1: createSkeletonWorkflowV2Transition(`${name}Transition1`),
    },
    statuses: [],
  })

export const createConnectTransitionRule = (extensionId: string): WorkflowV2TransitionRule => ({
  ruleKey: 'connect:some-rule',
  parameters: { appKey: `${extensionId}` },
})
export const createForgeTransitionRule = (extensionId: string): WorkflowV2TransitionRule => ({
  ruleKey: 'forge:some-rule',
  parameters: { key: `${EXTENSION_ID_ARI_PREFIX}${extensionId}/some-suffix` },
})
export const createSystemTransitionRule = (): WorkflowV2TransitionRule => ({ ruleKey: 'system:some-rule' })
