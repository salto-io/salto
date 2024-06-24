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
import ZendeskClient from '../../src/client/client'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/business_hours_schedule'

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

describe('business hours schedule filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let mockPut: jest.SpyInstance
  const intervals = [{ start_time: 4860, end_time: 5340 }]
  const schedule = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'business_hours_schedule') }),
    {
      name: 'Test Schedule',
      time_zone: 'Central Time (US & Canada)',
      intervals,
    },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  it('should pass the correct params to deployChange and client on create', async () => {
    const id = 2
    const clonedSchedule = schedule.clone()
    mockDeployChange.mockImplementation(async () => ({ schedule: { id } }))
    mockPut = jest.spyOn(client, 'put')
    mockPut.mockResolvedValue({ status: 200, data: { schedule: { id } } })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedSchedule } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedSchedule } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['holidays'],
    })
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith({
      url: '/api/v2/business_hours/schedules/2/workweek',
      data: { workweek: { intervals } },
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedSchedule } }])
  })
  it('should pass the correct params to deployChange and client on modify', async () => {
    const id = 2
    const clonedBeforeSchedule = schedule.clone()
    const clonedAfterSchedule = schedule.clone()
    delete clonedBeforeSchedule.value.intervals
    clonedAfterSchedule.value.timezone = 'Alaska'
    clonedBeforeSchedule.value.id = id
    clonedAfterSchedule.value.id = id
    mockDeployChange.mockImplementation(async () => ({ schedule: { id } }))
    mockPut = jest.spyOn(client, 'put')
    mockPut.mockResolvedValue({ status: 200, data: { schedule: { id } } })
    const res = await filter.deploy([
      { action: 'modify', data: { before: clonedBeforeSchedule, after: clonedAfterSchedule } },
    ])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'modify', data: { before: clonedBeforeSchedule, after: clonedAfterSchedule } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['holidays'],
    })
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith({
      url: '/api/v2/business_hours/schedules/2/workweek',
      data: { workweek: { intervals } },
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([
      { action: 'modify', data: { before: clonedBeforeSchedule, after: clonedAfterSchedule } },
    ])
  })
  it('should pass the correct params to deployChange and client on remove', async () => {
    const id = 2
    const clonedSchedule = schedule.clone()
    clonedSchedule.value.id = id
    mockDeployChange.mockImplementation(async () => ({ schedule: { id } }))
    mockPut = jest.spyOn(client, 'put')
    mockPut.mockResolvedValue({ status: 200, data: { schedule: { id } } })
    const res = await filter.deploy([{ action: 'remove', data: { before: clonedSchedule } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'remove', data: { before: clonedSchedule } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['holidays'],
    })
    expect(mockPut).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([{ action: 'remove', data: { before: clonedSchedule } }])
  })
  it('should not update intervals if there was not change in intervals', async () => {
    const id = 2
    const clonedBeforeSchedule = schedule.clone()
    const clonedAfterSchedule = schedule.clone()
    clonedAfterSchedule.value.timezone = 'Alaska'
    clonedBeforeSchedule.value.id = id
    clonedAfterSchedule.value.id = id
    mockDeployChange.mockImplementation(async () => ({ schedule: { id } }))
    mockPut = jest.spyOn(client, 'put')
    mockPut.mockResolvedValue({ status: 200, data: { schedule: { id } } })
    const res = await filter.deploy([
      { action: 'modify', data: { before: clonedBeforeSchedule, after: clonedAfterSchedule } },
    ])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'modify', data: { before: clonedBeforeSchedule, after: clonedAfterSchedule } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['holidays'],
    })
    expect(mockPut).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([
      { action: 'modify', data: { before: clonedBeforeSchedule, after: clonedAfterSchedule } },
    ])
  })
  it('should return error if deployChange failed', async () => {
    const id = 2
    const clonedSchedule = schedule.clone()
    mockDeployChange.mockImplementation(async () => {
      throw new Error('err')
    })
    mockPut = jest.spyOn(client, 'put')
    mockPut.mockResolvedValue({ status: 200, data: { schedule: { id } } })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedSchedule } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedSchedule } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['holidays'],
    })
    expect(mockPut).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return error if client request failed', async () => {
    const id = 2
    const clonedSchedule = schedule.clone()
    mockDeployChange.mockImplementation(async () => ({ schedule: { id } }))
    mockPut = jest.spyOn(client, 'put')
    mockPut.mockImplementation(async () => {
      throw new Error('err')
    })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedSchedule } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedSchedule } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['holidays'],
    })
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
