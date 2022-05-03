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
import filterCreator, { APP_INSTALLATION_TYPE_NAME } from '../../src/filters/app'

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

describe('app installation filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  const app = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, APP_INSTALLATION_TYPE_NAME) }),
    {
      app_id: 1,
      settings: { name: 'My App', title: 'My App' },
      settings_objects: [{ name: 'name', value: 'My App' }, { name: 'title', value: 'My App' }],
    }
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

  it('should pass the correct params to deployChange and client on create and wait until the job is done', async () => {
    const id = 2
    const clonedApp = app.clone()
    mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedApp } },
      expect.anything(),
      expect.anything(),
      ['app', 'settings.title', 'settings_objects']
    )
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith({
      url: '/apps/job_statuses/123',
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'add', data: { after: clonedApp } }])
  })
  it('should pass the correct params to deployChange and client on modify', async () => {
    const id = 2
    const clonedBeforeApp = app.clone()
    const clonedAfterApp = app.clone()
    clonedAfterApp.value.settings = { name: 'My App - Updated', title: 'My App - Updated' }
    clonedBeforeApp.value.id = id
    clonedAfterApp.value.id = id
    mockDeployChange.mockImplementation(async () => ({ id }))
    const res = await filter.deploy(
      [{ action: 'modify', data: { before: clonedBeforeApp, after: clonedAfterApp } }]
    )
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'modify', data: { before: clonedBeforeApp, after: clonedAfterApp } },
      expect.anything(),
      expect.anything(),
      ['app', 'settings.title', 'settings_objects']
    )
    expect(mockGet).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([
        { action: 'modify', data: { before: clonedBeforeApp, after: clonedAfterApp } },
      ])
  })
  it('should return error if deployChange failed', async () => {
    const clonedApp = app.clone()
    mockDeployChange.mockImplementation(async () => { throw new Error('err') })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedApp } },
      expect.anything(),
      expect.anything(),
      ['app', 'settings.title', 'settings_objects']
    )
    expect(mockGet).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return error if client request failed', async () => {
    const id = 2
    const clonedApp = app.clone()
    mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockImplementation(async () => { throw new Error('err') })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedApp } },
      expect.anything(),
      expect.anything(),
      ['app', 'settings.title', 'settings_objects']
    )
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith({
      url: '/apps/job_statuses/123',
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return error if job status is failed', async () => {
    const id = 2
    const clonedApp = app.clone()
    mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockResolvedValue({ status: 200, data: { status: 'failed' } })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedApp } },
      expect.anything(),
      expect.anything(),
      ['app', 'settings.title', 'settings_objects']
    )
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith({
      url: '/apps/job_statuses/123',
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return error if create did not return job id', async () => {
    const id = 2
    const clonedApp = app.clone()
    mockDeployChange.mockImplementation(async () => ({ id }))
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockResolvedValue({ status: 200, data: { status: 'failed' } })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedApp } },
      expect.anything(),
      expect.anything(),
      ['app', 'settings.title', 'settings_objects']
    )
    expect(mockGet).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
