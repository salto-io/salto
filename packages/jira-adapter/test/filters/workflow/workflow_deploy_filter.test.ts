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
import { ElemID, getChangeData, InstanceElement, ObjectType, toChange, Value } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { walkOnValue } from '@salto-io/adapter-utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowFilter, { INITIAL_VALIDATOR } from '../../../src/filters/workflow/workflow_deploy_filter'
import { getFilterParams, mockClient } from '../../utils'
import { WITH_PERMISSION_VALIDATORS } from './workflow_values'
import {
  encodeCloudFields,
  SCRIPT_RUNNER_POST_FUNCTION_TYPE,
} from '../../../src/filters/script_runner/workflow/workflow_cloud'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

const logging = logger('jira-adapter/src/filters/workflow/workflow_deploy_filter')
const logErrorSpy = jest.spyOn(logging, 'error')

describe('workflowDeployFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let workflowType: ObjectType
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })

    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    filter = workflowFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>

    beforeEach(() => {
      deployChangeMock.mockClear()
    })
    it('should remove the last PermissionValidator with permissionKey CREATE_ISSUES', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, WITH_PERMISSION_VALIDATORS),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'name',
            transitions: [
              {
                name: 'tran1',
                type: 'initial',
                rules: {
                  validators: [
                    INITIAL_VALIDATOR,
                    {
                      type: 'PreviousStatusValidator',
                      configuration: {
                        previousStatus: {
                          id: '1',
                          name: 'name',
                        },
                      },
                    },
                    {
                      type: 'PermissionValidator',
                      configuration: {
                        permissionKey: 'OTHER',
                      },
                    },
                  ],
                },
              },
            ],
          }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should change ids from number to string on condition configuration', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {
            'tran1__From__none__Initial@fffsff': {
              name: 'tran1',
              type: 'initial',
              rules: {
                conditions: {
                  configuration: {
                    id: 1,
                    other: 3,
                  },
                  conditions: [
                    {
                      configuration: {
                        id: 2,
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'name',
            transitions: [
              {
                name: 'tran1',
                type: 'initial',
                rules: {
                  conditions: {
                    configuration: {
                      id: '1',
                      other: 3,
                    },
                    conditions: [
                      {
                        configuration: {
                          id: '2',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should add operations value', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, WITH_PERMISSION_VALIDATORS),
      })

      await filter.deploy([change])

      expect(getChangeData(change).value.operations).toEqual({ canEdit: true })
    })

    it('should not change the values if there are no transitions', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {},
        }),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'name',
            transitions: [],
          }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should not change the values if there are no rules', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {
            'tran1__From__none__Initial@fffsff': {
              name: 'tran1',
              type: 'initial',
            },
          },
        }),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'name',
            transitions: [
              {
                name: 'tran1',
                type: 'initial',
              },
            ],
          }),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should throw an error if workflow is invalid', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: 2,
        }),
      })

      const { deployResult } = await filter.deploy([change])
      expect(deployResult.errors).toHaveLength(1)
    })

    describe('transitionIds', () => {
      it('should throw when response values is not an array', async () => {
        const change = toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'workflowName',
            transitions: {
              'name__From__none__Initial@fffsff': {
                name: 'name',
                type: 'initial',
              },
            },
          }),
        })

        mockConnection.get.mockResolvedValue({
          status: 200,
          data: {
            values: {},
          },
        })

        const { deployResult } = await filter.deploy([change])

        expect(deployResult.errors).toHaveLength(1)
      })

      it('should throw when number of workflows in response is invalid', async () => {
        const change = toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'workflowName',
            transitions: {
              'name__From__none__Initial@fffsff': {
                name: 'name',
                type: 'initial',
              },
            },
          }),
        })

        mockConnection.get.mockResolvedValue({
          status: 200,
          data: {
            values: [],
          },
        })

        const { deployResult } = await filter.deploy([change])

        expect(deployResult.errors).toHaveLength(1)
      })

      it('should throw when workflow in response is invalid', async () => {
        const change = toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'workflowName',
            transitions: {
              'name__From__none__Initial@fffsff': {
                name: 'name',
                type: 'initial',
              },
            },
          }),
        })

        mockConnection.get.mockResolvedValue({
          status: 200,
          data: {
            values: [
              {
                transitions: 2,
              },
            ],
          },
        })

        const { deployResult } = await filter.deploy([change])

        expect(deployResult.errors).toHaveLength(1)
      })

      it('should throw when there are not transitions in response', async () => {
        const change = toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'workflowName',
            transitions: {
              'name__From__none__Initial@fffsff': {
                name: 'name',
                type: 'initial',
              },
            },
          }),
        })

        mockConnection.get.mockResolvedValue({
          status: 200,
          data: {
            values: [
              {
                name: 'name',
              },
            ],
          },
        })

        const { deployResult } = await filter.deploy([change])

        expect(deployResult.errors).toHaveLength(1)
      })
      it('should add transitionIds to the workflow', async () => {
        const INITIAL_KEY = 'name__From__none__Initial@fffsff'
        const change = toChange({
          after: new InstanceElement('instance', workflowType, {
            name: 'workflowName',
            transitions: {
              [INITIAL_KEY]: {
                name: 'name',
                type: 'initial',
              },
            },
          }),
        })
        mockConnection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [],
          },
        })
        mockConnection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '1',
                    type: 'initial',
                  },
                ],
              },
            ],
          },
        })
        await filter.deploy([change])
        expect(getChangeData(change).value.transitions[INITIAL_KEY].id).toEqual('1')
      })
    })

    describe('transitionIds references', () => {
      const INITIAL_KEY = 'name__From__none__Initial@fffsff'
      const TRANSITION_KEY_2 = 'name2__From__any_status__Global@fffssff'
      const scriptRunnerWithRef = (id: string): Value => {
        const result = {
          type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
          configuration: {
            scriptRunner: {
              transitionId: id,
            },
          },
        }
        walkOnValue({ elemId: new ElemID(JIRA, 'none'), value: result, func: encodeCloudFields(false) })
        return result
      }

      let instance: InstanceElement
      let filterSR: filterUtils.FilterWith<'onFetch' | 'deploy'>
      let clientSR: JiraClient
      let mockConnectionSR: MockInterface<clientUtils.APIConnection>
      beforeEach(async () => {
        const { client: cli, paginator, connection } = mockClient()
        clientSR = cli
        mockConnectionSR = connection
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableScriptRunnerAddon = true
        filterSR = workflowFilter(
          getFilterParams({
            client: clientSR,
            paginator,
            config,
          }),
        ) as typeof filter
        instance = new InstanceElement('instance', workflowType, {
          name: 'workflowName',
          transitions: {
            [INITIAL_KEY]: {
              name: 'name',
              type: 'initial',
              rules: {
                postFunctions: [scriptRunnerWithRef('1')],
              },
            },
            [TRANSITION_KEY_2]: {
              name: 'name2',
              type: 'global',
              to: [1],
              rules: {
                postFunctions: [scriptRunnerWithRef('11')],
              },
            },
          },
        })
      })
      it('should deploy once if the transitionId is expected', async () => {
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '1',
                    type: 'initial',
                  },
                  {
                    name: 'name2',
                    id: '11',
                    type: 'global',
                    to: [1],
                  },
                ],
              },
            ],
          },
        })
        await filterSR.deploy([toChange({ after: instance })])
        expect(deployChangeMock).toHaveBeenCalledOnce()
        // two calls, one for transitions, one for step deployment
        expect(mockConnectionSR.get).toHaveBeenCalledTimes(2)
      })
      it('should deploy three times if the transitionId was not expected', async () => {
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [],
          },
        })
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '11',
                    type: 'initial',
                  },
                  {
                    name: 'name2',
                    id: '1',
                    type: 'global',
                    to: [1],
                  },
                ],
              },
            ],
          },
        })
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [],
          },
        })
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '11',
                    type: 'initial',
                  },
                  {
                    name: 'name2',
                    id: '1',
                    type: 'global',
                    to: [1],
                  },
                ],
              },
            ],
          },
        })
        await filterSR.deploy([toChange({ after: instance })])
        // first call with the failed prediction, second for deleting it and third for the correct one
        expect(deployChangeMock).toHaveBeenCalledTimes(3)
        expect(deployChangeMock).toHaveBeenCalledWith({
          change: toChange({
            after: new InstanceElement('instance', workflowType, {
              name: 'workflowName',
              transitions: [
                {
                  name: 'name',
                  type: 'initial',
                  rules: {
                    postFunctions: [scriptRunnerWithRef('1')],
                  },
                },
                {
                  name: 'name2',
                  type: 'global',
                  to: [1],
                  rules: {
                    postFunctions: [scriptRunnerWithRef('11')],
                  },
                },
              ],
            }),
          }),
          client: clientSR,
          endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
          fieldsToIgnore: expect.toBeFunction(),
        })
        expect(deployChangeMock).toHaveBeenCalledWith({
          change: toChange({
            after: new InstanceElement('instance', workflowType, {
              name: 'workflowName',
              transitions: [
                {
                  name: 'name',
                  type: 'initial',
                  rules: {
                    postFunctions: [scriptRunnerWithRef('11')],
                  },
                },
                {
                  name: 'name2',
                  type: 'global',
                  to: [1],
                  rules: {
                    postFunctions: [scriptRunnerWithRef('1')],
                  },
                },
              ],
            }),
          }),
          client: clientSR,
          endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
          fieldsToIgnore: expect.toBeFunction(),
        })
        instance.value.transitions[INITIAL_KEY].id = undefined
        instance.value.transitions[TRANSITION_KEY_2].id = undefined
        instance.value.operations = undefined
        expect(deployChangeMock).toHaveBeenCalledWith({
          change: toChange({
            before: instance,
          }),
          client: clientSR,
          endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Workflow.deployRequests,
          fieldsToIgnore: expect.toBeFunction(),
        })
        // five calls, two for checking if the workflow exist, two for transitions, one for step deployment
        expect(mockConnectionSR.get).toHaveBeenCalledTimes(5)
      })
      it('should throw if two deployments are not enough', async () => {
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [],
          },
        })
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '11',
                    type: 'initial',
                  },
                  {
                    name: 'name2',
                    id: '1',
                    type: 'global',
                    to: [1],
                  },
                ],
              },
            ],
          },
        })
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [],
          },
        })
        mockConnectionSR.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '21',
                    type: 'initial',
                  },
                  {
                    name: 'name2',
                    id: '1',
                    type: 'global',
                    to: [1],
                  },
                ],
              },
            ],
          },
        })
        const { deployResult } = await filterSR.deploy([toChange({ after: instance })])
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].message).toEqual('Error: Failed to deploy workflow, transition ids changed')
        expect(deployChangeMock).toHaveBeenCalledTimes(3)
        // two calls for transitions and two calls to check if the workflow exist
        expect(mockConnectionSR.get).toHaveBeenCalledTimes(4)
      })
    })

    it('should not send request when data center', async () => {
      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'workflowName',
          transitions: [
            {
              name: 'name',
              type: 'initial',
            },
          ],
        }),
      })

      const { client: cli, paginator, connection } = mockClient(true)
      filter = workflowFilter(
        getFilterParams({
          client: cli,
          paginator,
        }),
      ) as typeof filter

      await filter.deploy([change])

      expect(connection.get).not.toHaveBeenCalledWith('/rest/workflowDesigner/1.0/workflows', expect.anything())
    })
    describe('workflow diagrams', () => {
      let instance: InstanceElement
      const TRANSITION_KEY_3 = 'hey__From__Open__Directed@fffsff'
      beforeEach(() => {
        instance = new InstanceElement('instance', workflowType, {
          name: 'workflowName',
          statuses: [
            {
              name: 'Resolved',
              id: '5',
              location: {
                x: -33,
                y: 3,
              },
            },
            {
              name: 'Open',
              id: '1',
              location: {
                x: -3,
                y: 3,
              },
            },
            {
              name: 'The best name',
              id: '10007',
              location: {
                x: 3,
                y: -3,
              },
            },
            {
              name: 'Create',
              id: '5',
              location: {
                x: 3,
                y: 33,
              },
            },
            {
              name: 'Building',
              id: '400',
              location: {
                x: 33,
                y: 3,
              },
            },
            {
              name: 'without location',
              id: '500',
            },
          ],
          diagramInitialEntry: {
            x: 33,
            y: 66,
          },
          diagramGlobalLoopedTransition: {
            x: -15.85,
            y: 109.4,
          },
          transitions: {
            'Building__From__any_status__Global@fffssff': {
              name: 'Building',
              to: '400',
              type: 'global',
            },
            'Create__From__none__Initial@fffsff': {
              name: 'Create',
              to: '1',
              type: 'initial',
              from: [
                {
                  sourceAngle: 11,
                  targetAngle: 19,
                },
              ],
            },
            [TRANSITION_KEY_3]: {
              name: 'hey',
              to: '5',
              type: 'directed',
              from: [
                {
                  id: '1',
                  sourceAngle: 19,
                  targetAngle: 11,
                },
              ],
            },
            'super__From__the_best_name__Directed@fffsssff': {
              name: 'super',
              from: [
                {
                  id: '10007',
                  sourceAngle: 111,
                  targetAngle: 199,
                },
              ],
              to: '400',
              type: 'directed',
            },
            'yey__From__Resolved__Directed@fffsff': {
              name: 'yey',
              from: [
                {
                  id: 5,
                  sourceAngle: 111,
                  targetAngle: 1,
                },
              ],
              to: '10007',
              type: 'directed',
            },
            'with_from_a_string__From__Resolved__Directed@sssfffssff': {
              name: 'with from as string',
              from: ['5'],
              to: '10007',
              type: 'directed',
            },
            'looped__From__any_status__Circular@fffssff': {
              name: 'looped',
              from: [],
              to: '',
              type: 'global',
            },
          },
        })
        mockConnection.post.mockResolvedValue({
          status: 200,
          data: {},
        })
        mockConnection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [],
          },
        })
        mockConnection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                transitions: [
                  {
                    name: 'name',
                    id: '1',
                  },
                ],
              },
            ],
          },
        })
        mockConnection.get.mockResolvedValue({
          status: 200,
          data: {
            isDraft: false,
            layout: {
              statuses: [
                {
                  id: 'S<3>',
                  name: 'Open',
                  stepId: '3',
                  statusId: '1',
                  x: 3,
                  y: 6,
                },
                {
                  id: 'I<1>',
                  name: 'Create',
                  stepId: '1',
                  initial: true,
                  x: 33,
                  y: 66,
                },
                {
                  id: 'S<4>',
                  name: 'Resolved',
                  stepId: '4',
                  statusId: '5',
                  x: -3,
                  y: 6,
                },
                {
                  id: 'S<1>',
                  name: 'Building',
                  stepId: '1',
                  statusId: '400',
                  x: 3,
                  y: -66,
                },
                {
                  id: 'S<2>',
                  name: 'The best name',
                  stepId: '2',
                  statusId: '10007',
                  x: 33,
                  y: -66,
                },
                {
                  id: 'S<22>',
                  name: 'without x and y',
                  stepId: '5',
                  statusId: '500',
                  x: 3333,
                  y: -6666,
                },
              ],
              transitions: [
                {
                  id: 'A<31:S<2>:S<1>>',
                  name: 'super',
                  sourceId: 'S<2>',
                  targetId: 'S<1>',
                  sourceAngle: 34.11,
                  targetAngle: 173.58,
                },
                {
                  id: 'IA<1:I<1>:S<3>>',
                  name: 'Create',
                  sourceId: 'I<1>',
                  targetId: 'S<3>',
                  sourceAngle: 99.11,
                  targetAngle: 173.58,
                },
                {
                  id: 'A<41:S<4>:S<2>>',
                  name: 'yey',
                  sourceId: 'S<4>',
                  targetId: 'S<2>',
                  sourceAngle: 78.11,
                  targetAngle: 122.58,
                },
                {
                  id: 'A<21:S<3>:S<4>>',
                  name: 'hey',
                  sourceId: 'S<3>',
                  targetId: 'S<4>',
                  sourceAngle: -78.11,
                  targetAngle: 173.58,
                },
                {
                  id: 'A<51:S<3>:S<4>>',
                  name: 'with from as string',
                  sourceId: 'S<4>',
                  targetId: 'S<2>',
                  sourceAngle: 78.11,
                  targetAngle: 122.58,
                },
                {
                  id: 'A<11:S<1>:S<1>>',
                  name: 'Building',
                  sourceId: 'S<1>',
                  targetId: 'S<1>',
                  sourceAngle: 78.11,
                  targetAngle: -173.58,
                },
                {
                  id: 'A<51:S<-1>:S<-1>>',
                  name: 'looped',
                  sourceId: 'S<-1>',
                  targetId: 'S<-1>',
                  globalTransition: true,
                  loopedTransition: true,
                },
              ],
              loopedTransitionContainer: {
                x: -15.85,
                y: 109.4,
              },
            },
          },
        })
        filter = workflowFilter(
          getFilterParams({
            client,
          }),
        ) as typeof filter
      })
      afterEach(() => {
        jest.clearAllMocks()
      })
      it('should deploy workflow diagram values', async () => {
        await filter.deploy([toChange({ after: instance })])
        expect(mockConnection.post).toHaveBeenCalledWith(
          '/rest/workflowDesigner/latest/workflows',
          {
            name: 'workflowName',
            draft: false,
            layout: {
              statuses: [
                {
                  id: 'S<4>',
                  x: -33,
                  y: 3,
                },
                {
                  id: 'S<3>',
                  x: -3,
                  y: 3,
                },
                {
                  id: 'S<2>',
                  x: 3,
                  y: -3,
                },
                {
                  id: 'S<4>',
                  x: 3,
                  y: 33,
                },
                {
                  id: 'S<1>',
                  x: 33,
                  y: 3,
                },
                {
                  id: 'S<22>',
                },
                {
                  id: 'I<1>',
                  x: 33,
                  y: 66,
                },
              ],
              transitions: [
                {
                  id: 'IA<1:I<1>:S<3>>',
                  sourceId: 'I<1>',
                  targetId: 'S<3>',
                  sourceAngle: 11,
                  targetAngle: 19,
                },
                {
                  id: 'A<21:S<3>:S<4>>',
                  sourceId: 'S<3>',
                  targetId: 'S<4>',
                  sourceAngle: 19,
                  targetAngle: 11,
                },
                {
                  id: 'A<31:S<2>:S<1>>',
                  sourceId: 'S<2>',
                  targetId: 'S<1>',
                  sourceAngle: 111,
                  targetAngle: 199,
                },
                {
                  id: 'A<41:S<4>:S<2>>',
                  sourceId: 'S<4>',
                  targetId: 'S<2>',
                  sourceAngle: 111,
                  targetAngle: 1,
                },
              ],
              loopedTransitionContainer: {
                x: -15.85,
                y: 109.4,
              },
            },
          },
          { headers: { 'X-Atlassian-Token': 'no-check' }, params: undefined, responseType: undefined },
        )
      })
      it('should log error when transition from id is undefined', async () => {
        instance.value.transitions[TRANSITION_KEY_3].from[0].id = undefined
        await filter.deploy([toChange({ after: instance })])
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Fail to deploy Workflow workflowName diagram with the error: Fail to deploy Workflow workflowName Transition hey diagram values',
        )
      })

      it('should log error when post return an error ', async () => {
        mockConnection.post.mockResolvedValue({
          status: 400,
          data: {},
        })
        await filter.deploy([toChange({ after: instance })])
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Fail to deploy Workflow workflowName diagram with the error: Fail to post Workflow workflowName diagram values with status 400',
        )
      })
      it('should log error when status does not have id ', async () => {
        instance.value.statuses[2].id = undefined
        await filter.deploy([toChange({ after: instance })])
        expect(logErrorSpy).toHaveBeenCalledWith(
          'Fail to deploy Workflow workflowName diagram with the error: Fail to deploy Workflow workflowName Status The best name Diagram values',
        )
      })
      it('should work ok with partial transition from values', async () => {
        instance.value.transitions[TRANSITION_KEY_3].from[0].targetAngle = undefined
        await filter.deploy([toChange({ after: instance })])
        expect(logErrorSpy).not.toHaveBeenCalled()
      })
    })

    it('should throw an error when workflow exist', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [
            {
              id: {
                entityId: 'id',
              },
            },
          ],
        },
      })

      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {},
        }),
      })

      const {
        deployResult: { errors, appliedChanges },
      } = await filter.deploy([change])

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Error: A workflow with the name "name" already exists')
      expect(appliedChanges).toHaveLength(0)
    })

    it('should throw if deploy returns unknown error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [],
        },
      })

      deployChangeMock.mockRejectedValueOnce(new Error('unknown error'))

      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {},
        }),
      })

      const {
        deployResult: { errors, appliedChanges },
      } = await filter.deploy([change])

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Error: unknown error')
      expect(appliedChanges).toHaveLength(0)
    })

    it('should get the id from the service if received an error that the workflow exist', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [],
        },
      })

      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [
            {
              id: {
                entityId: 'id',
              },
            },
          ],
        },
      })

      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [
            {
              id: {
                entityId: 'id',
              },
            },
          ],
        },
      })

      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          layout: {
            statuses: [],
          },
        },
      })

      deployChangeMock.mockRejectedValueOnce(new Error("A workflow with the name 'name' already exists"))

      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {},
        }),
      })

      const {
        deployResult: { errors, appliedChanges },
      } = await filter.deploy([change])

      expect(errors).toHaveLength(0)
      expect(appliedChanges).toHaveLength(1)
    })

    it('should throw an error if got an error about the workflow being exist and failed to get the workflow id', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [],
        },
      })

      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [],
        },
      })

      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          layout: {
            statuses: [],
          },
        },
      })

      deployChangeMock.mockRejectedValueOnce(new Error("A workflow with the name 'name' already exists"))

      const change = toChange({
        after: new InstanceElement('instance', workflowType, {
          name: 'name',
          transitions: {},
        }),
      })

      const {
        deployResult: { errors, appliedChanges },
      } = await filter.deploy([change])

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("Error: A workflow with the name 'name' already exists")
      expect(appliedChanges).toHaveLength(0)
    })
  })
})
