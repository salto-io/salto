/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  InstanceElement,
  ElemID,
  ObjectType,
  ReadOnlyElementsSource,
  Value,
  isReferenceExpression,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements, WALK_NEXT_STEP, walkOnValue } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { adapter } from '../src/adapter_creator'
import { Credentials } from '../src/auth'
import { JiraConfig, getDefaultConfig } from '../src/config/config'
import JiraClient, { GET_CLOUD_ID_URL } from '../src/client/client'
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
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../src/filters/fields/constants'

export const createCredentialsInstance = (credentials: Credentials): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.authenticationMethods.basic.credentialsType, credentials)

export const createConfigInstance = (config: JiraConfig): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, config)

export const DEFAULT_CLOUD_ID = 'cloudId'
const DEFAULT_RESPONSE = { status: 200, data: '' }
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
export const mockClient = (
  isDataCenter = false,
  mockedCloudId: string | null = DEFAULT_CLOUD_ID,
  allowUserCallFailure = false,
): ClientWithMockConnection => {
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
  if (mockedCloudId !== null) {
    client.getCloudId = async () => mockedCloudId
  }

  const paginator = clientUtils.createPaginator({ paginationFuncCreator: paginate, client, asyncRun: true })
  const getUserMapFunc = getUserMapFuncCreator(paginator, client.isDataCenter, allowUserCallFailure)
  const scriptRunnerClient = new ScriptRunnerClient({
    credentials: {},
    isDataCenter,
    jiraClient: client,
  })

  return { client, paginator, connection, getUserMapFunc, scriptRunnerClient }
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

// Should be used instead of the default buildElementsSourceFromElements in order to better mock
// the elementsSource in real scenarios
export const createMockElementsSource = (elements: InstanceElement[]): ReadOnlyElementsSource => {
  const mockedElements = elements.map(instance => instance.clone())
  mockedElements.forEach(instance => {
    walkOnValue({
      value: instance.value,
      elemId: instance.elemID,
      func: ({ value }) => {
        if (isReferenceExpression(value)) {
          value.value = undefined
        }
        return WALK_NEXT_STEP.RECURSE
      },
    })
  })
  return buildElementsSourceFromElements(mockedElements)
}

export const FAULTY_CLOUD_ID_RESPONSE = (url: string): Value => {
  if (url === GET_CLOUD_ID_URL) {
    return {
      status: 200,
      data: { some_field: '' },
    }
  }

  throw new Error(`Unexpected url ${url}`)
}

export const generateOptionInstances = ({
  count,
  parent,
  addId,
}: {
  count: number
  parent: InstanceElement
  addId?: boolean
}): InstanceElement[] =>
  _.range(count).map(
    i =>
      new InstanceElement(
        `autoGenerated${i}`,
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        { value: `auto${i}`, id: addId ? `100${i}` : undefined },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, _.cloneDeep(parent)),
        },
      ),
  )
