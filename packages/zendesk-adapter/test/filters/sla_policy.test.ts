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
import { createFilterCreatorParams } from '../utils'
import { SLA_POLICY_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/sla_policy'

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

describe('sla policy filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const slaPolicyType = new ObjectType({
    elemID: new ElemID(ZENDESK, SLA_POLICY_TYPE_NAME),
  })
  const slaPolicyWithFilter = new InstanceElement('withFilter', slaPolicyType, {
    title: 'withFilter',
    policy_metrics: [
      {
        priority: 'urgent',
        metric: 'requester_wait_time',
        target: 120,
        business_hours: false,
      },
    ],
    filter: {
      all: [
        {
          field: 'ticket_is_public',
          operator: 'is',
          value: 'public',
        },
      ],
    },
  })
  const slaPolicyWithoutFilter = new InstanceElement('withoutFilter', slaPolicyType, {
    title: 'withoutFilter',
    policy_metrics: [
      {
        priority: 'urgent',
        metric: 'requester_wait_time',
        target: 120,
        business_hours: false,
      },
    ],
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange on create - without filter', async () => {
      const id = 2
      const clonedSlaPolicy = slaPolicyWithoutFilter.clone()
      const clonedSlaPolicyToDeploy = slaPolicyWithoutFilter.clone()
      clonedSlaPolicyToDeploy.value.filter = { all: [], any: [] }
      // It's actually not deployed with id but its added to the element that we check
      clonedSlaPolicyToDeploy.value.id = id
      mockDeployChange.mockImplementation(async () => ({ sla_policy: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedSlaPolicy } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedSlaPolicyToDeploy } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedSlaPolicy } }])
    })

    it('should pass the correct params to deployChange on create - with filter', async () => {
      const id = 2
      const clonedSlaPolicy = slaPolicyWithFilter.clone()
      mockDeployChange.mockImplementation(async () => ({ sla_policy: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedSlaPolicy } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedSlaPolicy } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedSlaPolicy } }])
    })

    it('should pass the correct params to deployChange on update - without filter', async () => {
      const id = 2
      const clonedSlaPolicyBefore = slaPolicyWithoutFilter.clone()
      const clonedSlaPolicyAfter = slaPolicyWithoutFilter.clone()
      const clonedSlaPolicyToDeploy = slaPolicyWithoutFilter.clone()
      clonedSlaPolicyToDeploy.value.filter = { all: [], any: [] }
      clonedSlaPolicyToDeploy.value.id = id
      clonedSlaPolicyBefore.value.id = id
      clonedSlaPolicyAfter.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedSlaPolicyBefore, after: clonedSlaPolicyAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedSlaPolicyBefore, after: clonedSlaPolicyToDeploy } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedSlaPolicyBefore, after: clonedSlaPolicyAfter },
        },
      ])
    })

    it('should pass the correct params to deployChange on update - with filter', async () => {
      const id = 2
      const clonedSlaPolicyBefore = slaPolicyWithFilter.clone()
      const clonedSlaPolicyAfter = slaPolicyWithFilter.clone()
      clonedSlaPolicyBefore.value.id = id
      clonedSlaPolicyAfter.value.id = id
      clonedSlaPolicyAfter.value.title = 'edited'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedSlaPolicyBefore, after: clonedSlaPolicyAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedSlaPolicyBefore, after: clonedSlaPolicyAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedSlaPolicyBefore, after: clonedSlaPolicyAfter },
        },
      ])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedSlaPolicy = slaPolicyWithoutFilter.clone()
      clonedSlaPolicy.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedSlaPolicy } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      const clonedSlaPolicy = slaPolicyWithFilter.clone()
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedSlaPolicy } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedSlaPolicy } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
