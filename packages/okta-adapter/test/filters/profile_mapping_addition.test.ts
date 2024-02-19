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

import { MockInterface } from '@salto-io/test-utils'
import { ElemID, InstanceElement, ObjectType, toChange, getChangeData } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import profileMappingAdditionFilter from '../../src/filters/profile_mapping_addition'
import { OKTA, PROFILE_MAPPING_TYPE_NAME } from '../../src/constants'

describe('profileMappingAdditionFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const mappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const mappingInstance = new InstanceElement('mapping', mappingType, {
    source: {
      id: '111',
      name: 'salesforce',
      type: 'appuser',
    },
    target: {
      id: '222',
      name: 'user',
      type: 'user',
    },
    properties: {
      firstName: {
        expression: 'appuser.name',
        pushStatus: 'DONT_PUSH',
      },
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = profileMappingAdditionFilter(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should successfully deploy addition changes of profile mapping', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [
          {
            id: 'mappingId123',
            source: {
              id: '111',
              name: 'salesforce',
              type: 'appuser',
            },
            target: {
              id: '222',
              name: 'user',
              type: 'user',
            },
          },
        ],
      })
      mockConnection.post.mockResolvedValue({ status: 200, data: {} })
      const changes = [toChange({ after: mappingInstance })]
      const result = await filter.deploy(changes)
      expect(mockConnection.get).toHaveBeenCalledTimes(1)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/mappings', {
        headers: undefined,
        params: { sourceId: '111', targetId: '222' },
        responseType: undefined,
      })
      expect(mockConnection.post).toHaveBeenCalledTimes(1)
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(1)
      const instances = appliedChanges.map(change => getChangeData(change)) as InstanceElement[]
      expect(instances[0].value).toEqual({
        // validate id assigned to value
        id: 'mappingId123',
        source: {
          id: '111',
          name: 'salesforce',
          type: 'appuser',
        },
        target: {
          id: '222',
          name: 'user',
          type: 'user',
        },
        properties: {
          firstName: {
            expression: 'appuser.name',
            pushStatus: 'DONT_PUSH',
          },
        },
      })
    })

    it('should return error if sourceId or targetId is missing', async () => {
      const noTarget = new InstanceElement('noTarget', mappingType, {
        source: {
          id: '111',
          name: 'salesforce',
          type: 'appuser',
        },
      })
      const result = await filter.deploy([toChange({ after: noTarget })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors[0].message).toContain('ProfileMapping must have valid sourceId and targetId')
    })

    it('should return error if the required mapping cannot be find in the service', async () => {
      mockConnection.get.mockResolvedValue({ status: 200, data: [] })
      const result = await filter.deploy([toChange({ after: mappingInstance })])
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/mappings', {
        headers: undefined,
        params: { sourceId: '111', targetId: '222' },
        responseType: undefined,
      })
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors[0].message).toContain(
        'Could not find ProfileMapping with the provided sourceId and targetId',
      )
    })
  })
})
