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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { mockClient } from '../../utils'
import statusDeploymentFilter from '../../../src/filters/statuses/status_deployment'
import { Filter } from '../../../src/filter'
import { DEFAULT_CONFIG, JiraConfig } from '../../../src/config'
import { JIRA, PRIVATE_API_HEADERS } from '../../../src/constants'
import { STATUS_TYPE_NAME } from '../../../src/filters/statuses/constants'

describe('statusDeploymentFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection

    config = _.cloneDeep(DEFAULT_CONFIG)
    filter = statusDeploymentFilter({
      client,
      paginator,
      config,
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        statusCategory: { refType: BuiltinTypes.STRING },
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        name: 'Status',
        description: 'Desc',
        statusCategory: { id: '2' },
      }
    )

    mockConnection.get.mockResolvedValue({
      status: 200,
      data: [
        {
          id: '1',
          name: 'Status',
          description: 'Desc',
        },
      ],
    })

    mockConnection.post.mockRejectedValue({
      response: {
        status: 400,
        data: 'Given status does not exist',
      },
    })
  })

  describe('onFetch', () => {
    it('should do nothing if type is not found', async () => {
      await filter.onFetch?.([])
      expect(type.annotations).toEqual({})
    })

    it('should do nothing if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch?.([type])
      expect(type.annotations).toEqual({})
    })

    it('should add deployment annotations', async () => {
      await filter.onFetch?.([type])
      expect(type.annotations).toEqual({ [CORE_ANNOTATIONS.CREATABLE]: true })
      expect(type.fields.name.annotations).toEqual({ [CORE_ANNOTATIONS.CREATABLE]: true })
      expect(type.fields.description.annotations).toEqual({ [CORE_ANNOTATIONS.CREATABLE]: true })
      expect(type.fields.statusCategory.annotations).toEqual({ [CORE_ANNOTATIONS.CREATABLE]: true })
    })
  })

  describe('deploy', () => {
    it('should deploy the statuses', async () => {
      const res = await filter.deploy?.([toChange({ after: instance })])

      expect(res?.deployResult.appliedChanges).toHaveLength(1)
      const appliedChange = res?.deployResult.appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(appliedChange).value.id).toBe('1')

      expect(res?.deployResult.errors).toHaveLength(0)

      expect(mockConnection.post).toHaveBeenCalledWith(
        '/rest/workflowDesigner/1.0/workflows/statuses/create',
        {
          name: ['Status'],
          description: ['Desc'],
          statusCategoryId: ['2'],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should set to no category if there is no category', async () => {
      delete instance.value.statusCategory
      const res = await filter.deploy?.([toChange({ after: instance })])

      expect(res?.deployResult.appliedChanges).toHaveLength(1)
      const appliedChange = res?.deployResult.appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(appliedChange).value.id).toBe('1')

      expect(res?.deployResult.errors).toHaveLength(0)

      expect(mockConnection.post).toHaveBeenCalledWith(
        '/rest/workflowDesigner/1.0/workflows/statuses/create',
        {
          name: ['Status'],
          description: ['Desc'],
          statusCategoryId: ['1'],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should return an error if received unexpected error', async () => {
      mockConnection.post.mockRejectedValue(new Error('other'))

      const res = await filter.deploy?.([toChange({ after: instance })])

      expect(res?.deployResult.appliedChanges).toHaveLength(0)
      expect(res?.deployResult.errors).toHaveLength(1)
    })

    it('should return an error if the id of the new status was not returned', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [],
      })

      const res = await filter.deploy?.([toChange({ after: instance })])

      expect(res?.deployResult.appliedChanges).toHaveLength(0)
      expect(res?.deployResult.errors).toHaveLength(1)
    })

    it('should return an error if failed to query the statuses', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: 2,
      })

      const res = await filter.deploy?.([toChange({ after: instance })])

      expect(res?.deployResult.appliedChanges).toHaveLength(0)
      expect(res?.deployResult.errors).toHaveLength(1)
    })
  })
})
