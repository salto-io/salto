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
import _ from 'lodash'
import { CORE_ANNOTATIONS, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { FilterResult } from '../../../src/filter'
import JiraClient from '../../../src/client/client'
import workflowFetchFilter from '../../../src/filters/workflowV2/workflow_fetch_filter'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA_WORKFLOW_TYPE } from '../../../src/constants'

describe('workflowFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch', FilterResult>
  let workflowType: ObjectType
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let mockPaginator: clientUtils.Paginator
  beforeEach(async () => {
    workflowType = createEmptyType(JIRA_WORKFLOW_TYPE)
    mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function *get() {
      yield [
        { id: { entityId: '1' } },
        { id: { entityId: '2' } },
      ]
    })
    const { client: cli, connection: conn } = mockClient()
    client = cli
    connection = conn
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableNewWorkflowAPI = true
    filter = workflowFetchFilter(getFilterParams({
      client,
      paginator: mockPaginator,
      config,
    })) as typeof filter
  })

  describe('onFetch', () => {
    beforeEach(() => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          workflows: [
            {
              id: '1',
              name: 'firstWorkflow',
              version: {
                versionNumber: 1,
                id: '1',
              },
              scope: {
                type: 'global',
              },
            },
            {
              id: '2',
              name: 'secondWorkflow',
              version: {
                versionNumber: 1,
                id: '2',
              },
              scope: {
                type: 'global',
              },
            },
          ],
        },
      })
    })
    it('should add workflow instances', async () => {
      const elements = [workflowType]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)
      const firstWorkflow = elements[1] as unknown as InstanceElement
      expect(elements[1].elemID.name).toEqual('firstWorkflow')
      expect(firstWorkflow.value).toEqual({
        id: '1',
        name: 'firstWorkflow',
        version: {
          versionNumber: 1,
          id: '1',
        },
        scope: {
          type: 'global',
        },
      })
      const secondWorkflow = elements[2] as unknown as InstanceElement
      expect(secondWorkflow.elemID.name).toEqual('secondWorkflow')
      expect(secondWorkflow.value).toEqual({
        id: '2',
        name: 'secondWorkflow',
        version: {
          versionNumber: 1,
          id: '2',
        },
        scope: {
          type: 'global',
        },
      })
    })
    it('should add workflows deployment annotations to JiraWorkflow type', async () => {
      const elements = [workflowType]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)
      expect(elements[0].annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })
    })
    it('should call paginator with the correct parameters', async () => {
      const elements = [workflowType]
      await filter.onFetch(elements)
      expect(mockPaginator).toHaveBeenCalledWith(
        {
          url: '/rest/api/3/workflow/search',
          paginationField: 'startAt',
        },
        expect.anything(),
      )
    })
    it('should call the client with the correct parameters', async () => {
      const elements = [workflowType]
      await filter.onFetch(elements)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/3/workflows',
        {
          workflowIds: ['1', '2'],
        },
        undefined,
      )
    })
    it('should not add workflow instances if new workflow api is disabled', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableNewWorkflowAPI = false
      filter = workflowFetchFilter(getFilterParams({
        client,
        paginator: mockFunction<clientUtils.Paginator>().mockImplementation(async function *get() {
          yield [
            { id: { entityId: '1' } },
            { id: { entityId: '2' } },
          ]
        }),
        config,
      })) as typeof filter
      const elements = [workflowType]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(1)
    })
    it('should fail when JiraWorkflow type is not found', async () => {
      const filterResult = await filter.onFetch([]) as FilterResult
      const errors = filterResult.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows.')
      expect(errors[0].severity).toEqual('Error')
    })
    it('should fail when id response data is not valid', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableNewWorkflowAPI = true
      mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function *get() {
        yield [
          { id: { notEntityId: '1' } },
        ]
      })
      filter = workflowFetchFilter(getFilterParams({
        client,
        paginator: mockPaginator,
        config,
      })) as typeof filter

      const elements = [workflowType]
      const filterResult = await filter.onFetch(elements) as FilterResult

      const errors = filterResult?.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows.')
      expect(errors[0].severity).toEqual('Error')
    })
    it('should fail when bulk get post request is rejected', async () => {
      connection.post.mockRejectedValue(new Error('code 400'))
      const elements = [workflowType]
      const filterResult = await filter.onFetch(elements) as FilterResult
      const errors = filterResult?.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows: Failed to post /rest/api/3/workflows with error: Error: code 400.')
      expect(errors[0].severity).toEqual('Error')
    })
    it('should throw when response data is not valid', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: { workflows: [{
          version: {
            invalidVersion: true,
          },
        }] },
      })
      const elements = [workflowType]
      const filterResult = await filter.onFetch(elements) as FilterResult
      const errors = filterResult?.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows.')
      expect(errors[0].severity).toEqual('Error')
    })
  })
})
