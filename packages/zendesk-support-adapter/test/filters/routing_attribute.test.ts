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
import {
  ObjectType, ElemID, InstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZENDESK_SUPPORT } from '../../src/constants'
import filterCreator from '../../src/filters/routing_attribute'

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
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const routingAttribute = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'routing_attribute') }),
    { name: 'Test', values: [] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      const clonedAttribute = routingAttribute.clone()
      mockDeployChange.mockImplementation(async () => ({ attribute: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedAttribute } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: clonedAttribute } },
        expect.anything(),
        expect.anything(),
        ['values'],
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: clonedAttribute } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 2
      const clonedAttributeBefore = routingAttribute.clone()
      const clonedAttributeAfter = routingAttribute.clone()
      clonedAttributeBefore.value.id = id
      clonedAttributeAfter.value.id = id
      clonedAttributeAfter.value.name = 'edited'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedAttributeBefore, after: clonedAttributeAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'modify', data: { before: clonedAttributeBefore, after: clonedAttributeAfter } },
        expect.anything(),
        expect.anything(),
        ['values']
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
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
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: clonedAttribute } },
        expect.anything(),
        expect.anything(),
        ['values'],
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
