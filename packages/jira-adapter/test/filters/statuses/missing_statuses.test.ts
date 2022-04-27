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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockClient } from '../../utils'
import missingStatusesFilter from '../../../src/filters/statuses/missing_statuses'
import { Filter } from '../../../src/filter'
import { DEFAULT_CONFIG, JiraConfig } from '../../../src/config'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'
import { PRIVATE_API_HEADERS } from '../../../src/client/client'

describe('missingStatusesFilter', () => {
  let filter: Filter
  let type: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection

    config = _.cloneDeep(DEFAULT_CONFIG)
    filter = missingStatusesFilter({
      client,
      paginator,
      config,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
    })
  })

  describe('onFetch', () => {
    it('should do nothing if type is not found', async () => {
      await filter.onFetch?.([])
      expect(mockConnection.get).not.toHaveBeenCalled()
    })

    it('should do nothing if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch?.([type])
      expect(mockConnection.get).not.toHaveBeenCalled()
    })

    it('should do nothing if response is invalid', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: 'invalid',
      })

      const elements = [type]
      await filter.onFetch?.(elements)
      expect(elements).toHaveLength(1)
    })

    it('should do nothing if request failed', async () => {
      mockConnection.get.mockResolvedValue({
        status: 400,
        data: 'invalid',
      })

      const elements = [type]
      await filter.onFetch?.(elements)
      expect(elements).toHaveLength(1)
    })

    it('should add the missing statuses to elements', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [
          {
            id: '1',
            name: 'Status1',
            description: 'Description 1',
          },
          {
            id: '2',
            name: 'Status2',
          },
        ],
      })

      const instance = new InstanceElement(
        'Status2',
        type,
        {
          id: '2',
          name: 'Status2',
        },
      )

      const elements = [type, instance]
      await filter.onFetch?.(elements)

      expect(mockConnection.get).toHaveBeenCalledWith(
        '/rest/workflowDesigner/1.0/statuses',
        {
          headers: PRIVATE_API_HEADERS,
        }
      )

      expect(elements.map(e => e.elemID.getFullName())).toEqual([
        type.elemID.getFullName(),
        instance.elemID.getFullName(),
        new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Status1').getFullName(),
      ])
    })
  })
})
