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
import { AdditionChange, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { deployTriggers } from '../../../src/filters/workflow/triggers_deployment'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { mockClient } from '../../utils'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'

describe('triggersDeployment', () => {
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
        transitions: [{
          name: 'name',
          rules: {
            triggers: [{
              key: 'key',
              configuration: { a: 'b' },
            }],
          },
        }],
      }
    )

    const { client: cli, connection } = mockClient()
    client = cli
    mockConnection = connection

    mockConnection.get.mockResolvedValue({
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
  })

  it('should call the deploy triggers endpoint', async () => {
    await deployTriggers(toChange({ after: instance }) as AdditionChange<InstanceElement>, client)

    expect(mockConnection.put).toHaveBeenCalledWith(
      '/rest/triggers/1.0/workflow/config',
      {
        definitionConfig: { a: 'b' },
        triggerDefinitionKey: 'key',
      },
      {
        headers: PRIVATE_API_HEADERS,
        params: {
          workflowName: 'workflowName',
          actionId: '1',
        },
      },
    )
  })

  it('should throw when workflow does not have a name', async () => {
    delete instance.value.name
    await expect(
      deployTriggers(toChange({ after: instance }) as AdditionChange<InstanceElement>, client)
    ).rejects.toThrow()
  })
})
