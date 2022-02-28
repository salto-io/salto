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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import JiraClient, { PRIVATE_API_HEADERS } from '../../../src/client/client'
import { DEFAULT_CONFIG, JiraConfig } from '../../../src/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import stepIdsFilter from '../../../src/filters/workflow/step_ids_filter'
import { mockClient } from '../../utils'

describe('stepIdsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let workflowType: ObjectType
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })

    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    config = _.cloneDeep(DEFAULT_CONFIG)

    filter = stepIdsFilter({
      client,
      paginator,
      config,
    }) as typeof filter
  })

  describe('onFetch', () => {
    it('should add stepIds field to the type', async () => {
      await filter.onFetch([workflowType])
      expect(workflowType.fields.stepIds).toBeDefined()
      expect(workflowType.fields.stepIds.annotations).toEqual({
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      })
    })

    it('should add stepIds value', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'workflowName',
          statuses: [
            { id: '1' },
            { id: '2' },
            { id: '3' },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          layout: {
            statuses: [
              {
                statusId: '1',
                stepId: '4',
              },
              {
                statusId: '2',
                stepId: '5',
              },
              {
                statusId: '3',
                stepId: '6',
              },
            ],
          },
        },
      })

      await filter.onFetch([instance])
      expect(instance.value.stepIds).toEqual({
        1: '4',
        2: '5',
        3: '6',
      })

      expect(mockConnection.get).toHaveBeenCalledWith(
        'rest/workflowDesigner/1.0/workflows',
        {
          params: {
            name: 'workflowName',
          },
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should do nothing if usePrivateAPI is false', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'workflowName',
          statuses: [
            { id: '1' },
            { id: '2' },
            { id: '3' },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          layout: {
            statuses: [
              {
                statusId: '1',
                stepId: '4',
              },
              {
                statusId: '2',
                stepId: '5',
              },
              {
                statusId: '3',
                stepId: '6',
              },
            ],
          },
        },
      })

      config.client.usePrivateAPI = false

      await filter.onFetch([instance])
      expect(instance.value.stepIds).toBeUndefined()
    })

    it('should do nothing if workflow does not have a name', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          statuses: [
            { id: '1' },
            { id: '2' },
            { id: '3' },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          layout: {
            statuses: [
              {
                statusId: '1',
                stepId: '4',
              },
              {
                statusId: '2',
                stepId: '5',
              },
              {
                statusId: '3',
                stepId: '6',
              },
            ],
          },
        },
      })

      await filter.onFetch([instance])
      expect(instance.value.stepIds).toBeUndefined()
    })
  })
})
