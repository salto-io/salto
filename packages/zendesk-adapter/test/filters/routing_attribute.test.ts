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
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/routing_attribute'
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

describe('routing attribute filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const routingAttribute = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute') }),
    { name: 'Test', values: [] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      const clonedAttribute = routingAttribute.clone()
      mockDeployChange.mockImplementation(async () => ({ attribute: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedAttribute } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedAttribute } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['values'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedAttribute } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 2
      const clonedAttributeBefore = routingAttribute.clone()
      const clonedAttributeAfter = routingAttribute.clone()
      clonedAttributeBefore.value.id = id
      clonedAttributeAfter.value.id = id
      clonedAttributeAfter.value.name = 'edited'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedAttributeBefore, after: clonedAttributeAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedAttributeBefore, after: clonedAttributeAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['values'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedAttributeBefore, after: clonedAttributeAfter },
        },
      ])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedAttribute = routingAttribute.clone()
      clonedAttribute.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedAttribute } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      const clonedAttribute = routingAttribute.clone()
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedAttribute } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedAttribute } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['values'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
