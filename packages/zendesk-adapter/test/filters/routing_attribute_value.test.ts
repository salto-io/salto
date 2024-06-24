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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ROUTING_ATTRIBUTE_VALUE_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/routing_attribute_value'
import { createFilterCreatorParams } from '../utils'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('routing attribute value filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const routingAttributeValue = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK, ROUTING_ATTRIBUTE_VALUE_TYPE_NAME) }),
    { name: 'Test', values: [] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange', async () => {
      const id = 2
      const clonedAttributeValue = routingAttributeValue.clone()
      mockDeployChange.mockImplementation(async () => ({ attribute: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedAttributeValue } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedAttributeValue } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedAttributeValue } }])
    })

    it('should return error if deployChange failed', async () => {
      const clonedAttributeValue = routingAttributeValue.clone()
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedAttributeValue } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedAttributeValue } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
