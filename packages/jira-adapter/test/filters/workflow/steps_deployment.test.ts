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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { mockClient } from '../../utils'
import { deploySteps } from '../../../src/filters/workflow/steps_deployment'
import { JSP_API_HEADERS } from '../../../src/client/headers'

describe('steps_deployment', () => {
  let workflowType: ObjectType
  let instance: InstanceElement
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    instance = new InstanceElement(
      'instance',
      workflowType,
      {
        name: 'workflowName',
        statuses: [
          {
            name: 'name1',
            id: new ReferenceExpression(new ElemID(JIRA, 'status'), { value: { name: 'name1', id: '1' } }),
          },
          {
            name: 'name2',
            id: new ReferenceExpression(new ElemID(JIRA, 'status'), { value: { name: 'other', id: '2' } }),
          },
          {
            name: 'name3',
            id: '3',
          },
        ],
      }
    )

    const { client: cli, connection } = mockClient()
    client = cli
    mockConnection = connection

    mockConnection.get.mockResolvedValue({
      status: 200,
      data: {
        layout: {
          statuses: [
            {
              statusId: 1,
              stepId: 4,
            },
            {
              statusId: 2,
              stepId: 5,
            },
            {
              statusId: 3,
              stepId: 6,
            },
          ],
        },
      },
    })
  })

  it('should call the deploy steps endpoint', async () => {
    await deploySteps(instance, client)

    expect(mockConnection.post).toHaveBeenCalledWith(
      '/secure/admin/workflows/EditWorkflowStep.jspa',
      new URLSearchParams({
        stepName: 'name2',
        workflowStep: '5',
        stepStatus: '2',
        workflowName: 'workflowName',
        workflowMode: 'live',
      }),
      {
        headers: JSP_API_HEADERS,
      },
    )

    expect(mockConnection.post).toHaveBeenCalledWith(
      '/secure/admin/workflows/EditWorkflowStep.jspa',
      new URLSearchParams({
        stepName: 'name3',
        workflowStep: '6',
        stepStatus: '3',
        workflowName: 'workflowName',
        workflowMode: 'live',
      }),
      {
        headers: JSP_API_HEADERS,
      },

    )

    expect(mockConnection.post).toHaveBeenCalledTimes(2)
  })

  it('should throw if workflow does not have a name', async () => {
    delete instance.value.name
    await expect(deploySteps(instance, client)).rejects.toThrow()
  })

  it('should throw if status does not have a name', async () => {
    delete instance.value.statuses[0].name
    await expect(deploySteps(instance, client)).rejects.toThrow()
  })

  it('should throw if status does not have an id', async () => {
    delete instance.value.statuses[0].id
    await expect(deploySteps(instance, client)).rejects.toThrow()
  })

  it('should throw if there are no step ids', async () => {
    mockConnection.get.mockResolvedValue({
      status: 200,
      data: {
        layout: {
          statuses: [],
        },
      },
    })

    await expect(deploySteps(instance, client)).rejects.toThrow()
  })
})
