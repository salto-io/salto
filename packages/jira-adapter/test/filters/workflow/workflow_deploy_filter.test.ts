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
import { ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowFilter, { INITIAL_VALIDATOR } from '../../../src/filters/workflow/workflow_deploy_filter'
import { getFilterParams, mockClient } from '../../utils'
import { WITH_PERMISSION_VALIDATORS } from './workflow_values'

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

    filter = workflowFilter(getFilterParams({
      client,
      paginator,
    })) as typeof filter
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >

    beforeEach(() => {
      deployChangeMock.mockClear()
    })
    it('should remove the last PermissionValidator with permissionKey CREATE_ISSUES', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          WITH_PERMISSION_VALIDATORS
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'name',
              transitions: [
                {
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
            }
          ),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should change ids from number to string on condition configuration', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            name: 'name',
            transitions: [
              {
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
            ],
          },
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'name',
              transitions: [
                {
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
            },
          ),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should add operations value', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          WITH_PERMISSION_VALIDATORS
        ),
      })

      await filter.deploy([change])

      expect(getChangeData(change).value.operations).toEqual({ canEdit: true })
    })

    it('should not change the values if there are no transitions', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            name: 'name',
            transitions: [],
          }
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'name',
              transitions: [],
            },
          ),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should not change the values if there are no rules', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            name: 'name',
            transitions: [
              {
                type: 'initial',
              },
            ],
          }
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'name',
              transitions: [
                {
                  type: 'initial',
                },
              ],
            },
          ),
        }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.Workflow.deployRequests,
        fieldsToIgnore: expect.toBeFunction(),
      })
    })

    it('should throw an error if workflow is invalid', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            name: 'name',
            transitions: 2,
          }
        ),
      })

      const { deployResult } = await filter.deploy([change])
      expect(deployResult.errors).toHaveLength(1)
    })

    describe('transitionIds', () => {
      it('should throw when response values is not an array', async () => {
        const change = toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'workflowName',
              transitions: [
                {
                  name: 'name',
                  type: 'initial',
                },
              ],
            },
          ),
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
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'workflowName',
              transitions: [
                {
                  name: 'name',
                  type: 'initial',
                },
              ],
            },
          ),
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
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'workflowName',
              transitions: [
                {
                  name: 'name',
                  type: 'initial',
                },
              ],
            },
          ),
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
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              name: 'workflowName',
              transitions: [
                {
                  name: 'name',
                  type: 'initial',
                },
              ],
            },
          ),
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
    })

    it('should not send request when data center', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            name: 'workflowName',
            transitions: [
              {
                name: 'name',
                type: 'initial',
              },
            ],
          },
        ),
      })


      const { client: cli, paginator, connection } = mockClient(true)

      filter = workflowFilter(getFilterParams({
        client: cli,
        paginator,
      })) as typeof filter

      await filter.deploy([change])

      expect(connection.get).not.toHaveBeenCalledWith('/rest/workflowDesigner/1.0/workflows', expect.anything())
    })
    describe('workflow diagrams', () => {
      let instance: InstanceElement
      beforeEach(() => {
        instance = new InstanceElement(
          'instance',
          workflowType,
          {
            name: 'workflowName',
            statuses: [
              {
                name: 'Resolved',
                id: '5',
                direction: {
                  x: -33,
                  y: 3,
                },
              },
              {
                name: 'Open',
                id: '1',
                direction: {
                  x: -3,
                  y: 3,
                },
              },
              {
                name: 'The best name',
                id: '10007',
                direction: {
                  x: 3,
                  y: -3,
                },
              },
              {
                name: 'Create',
                id: '5',
                direction: {
                  x: 3,
                  y: 33,
                },
              },
              {
                name: 'Building',
                id: '400',
                direction: {
                  x: 33,
                  y: 3,
                },
              },
              {
                name: 'without direction',
                id: '500',
              },
            ],
            transitions: [
              {
                name: 'Building',
                to: '400',
                type: 'global',
              },
              {
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
              {
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
              {
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
              {
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
            ],
          }
        )
        mockConnection.post.mockResolvedValue({
          status: 200,
          data: {
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
                  id: 'A<11:S<1>:S<1>>',
                  name: 'Building',
                  sourceId: 'S<1>',
                  targetId: 'S<1>',
                  sourceAngle: 78.11,
                  targetAngle: -173.58,
                },
              ],
            },
          },
        })
        filter = workflowFilter(getFilterParams({
          client,
        })) as typeof filter
      })
      afterEach(() => {
        jest.clearAllMocks()
      })
      it('should deploy workflow diagram values', async () => {
        await filter.deploy([toChange(
          { after: instance }
        )])
        expect(mockConnection.post).toHaveBeenCalledWith('/rest/workflowDesigner/latest/workflows', {
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
          },
        },
        { headers: { 'X-Atlassian-Token': 'no-check' },
          params: undefined,
          responseType: undefined },)
      })
      it('should log error when transition from id is undefined', async () => {
        instance.value.transitions[2].from[0].id = undefined
        await filter.deploy([toChange(
          { after: instance }
        )])
        expect(logErrorSpy).toHaveBeenCalledWith('Fail to deploy Workflow workflowName diagram with the error: Fail to deploy Workflow workflowName Transition hey diagram values')
      })

      it('should log error when post return an error ', async () => {
        mockConnection.post.mockResolvedValue({
          status: 400,
          data: {
          },
        })
        await filter.deploy([toChange(
          { after: instance }
        )])
        expect(logErrorSpy).toHaveBeenCalledWith('Fail to deploy Workflow workflowName diagram with the error: Fail to post Workflow workflowName diagram values with status 400')
      })
      it('should work ok with no statuses and no transitions', async () => {
        instance.value.statuses = undefined
        instance.value.transitions = undefined
        await filter.deploy([toChange(
          { after: instance }
        )])
        expect(logErrorSpy).not.toHaveBeenCalled()
      })
    })
  })
})
