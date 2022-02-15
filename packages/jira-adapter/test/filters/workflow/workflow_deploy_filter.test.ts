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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowFilter, { INITIAL_VALIDATOR } from '../../../src/filters/workflow/workflow_deploy_filter'
import { mockClient } from '../../utils'
import { WITH_PERMISSION_VALIDATORS, WITH_SCRIPT_RUNNERS } from './workflow_values'

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
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter
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

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
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
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should remove the undeployable post functions and validators', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          WITH_SCRIPT_RUNNERS
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: [
                {
                  rules: {
                    validators: [
                      {
                        type: 'other',
                      },
                      {
                        val: 'val',
                      },
                    ],
                    postFunctions: [
                      {
                        type: 'other',
                      },
                      {
                        val: 'val',
                      },
                    ],
                  },
                },
              ],
            }
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should not change the values if there are no transitions', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {}
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {},
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should not change the values if there are no rules', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                type: 'initial',
              },
            ],
          }
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: [
                {
                  type: 'initial',
                },
              ],
            },
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should not change the values if values are not a valid workflow', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: 2,
          }
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: 2,
            },
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })
  })
})
