/*
*                      Copyright 2022 Salto Labs Ltd.
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
                        configuration: [{
                          id: 2,
                        }],
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
                          configuration: [{
                            id: '2',
                          }],
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
  })
})
