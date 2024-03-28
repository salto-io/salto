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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  createSaltoElementError,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../src/client/client'
import { APP_INSTALLATION_TYPE_NAME, APP_OWNED_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/app_installations'
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

describe('app installation filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  const app = new InstanceElement('Test', new ObjectType({ elemID: new ElemID(ZENDESK, APP_INSTALLATION_TYPE_NAME) }), {
    app_id: 1,
    settings: { name: 'My App', title: 'My App' },
    settings_objects: [
      { name: 'name', value: 'My App' },
      { name: 'title', value: 'My App' },
    ],
  })
  const appOwned = new InstanceElement(
    'appOwned',
    new ObjectType({ elemID: new ElemID(ZENDESK, APP_OWNED_TYPE_NAME) }),
    {
      id: 1,
    },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    it('should remove settings object on fetch', async () => {
      const appInstallation = app.clone()
      await filter.onFetch([appInstallation])
      const appCloneWithoutSettingsObject = app.clone()
      appCloneWithoutSettingsObject.value.settings_objects = undefined
      expect(appInstallation).toEqual(appCloneWithoutSettingsObject)
    })

    it('should replace app_id of app_installation with a ReferenceExpression to the corresponding app_owned', async () => {
      const appInstallation = app.clone()
      await filter.onFetch([appInstallation, appOwned])
      expect(appInstallation.value.app_id).toEqual(new ReferenceExpression(appOwned.elemID, appOwned))
    })

    it('should not modify app_id of app_installation if corresponding app_owned is not found', async () => {
      const appInstallation = app.clone()
      appInstallation.value.app_id = 2
      await filter.onFetch([appInstallation, appOwned])
      expect(appInstallation.value.app_id).toEqual(2)
    })
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange and client on create and wait until the job is done', async () => {
      const id = 2
      const clonedApp = app.clone()
      const expectedClonedApp = app.clone()
      expectedClonedApp.value.id = id
      mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: expectedClonedApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(mockGet).toHaveBeenCalledWith({
        url: '/api/v2/apps/job_statuses/123',
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedApp } }])
    })
    it('should pass the correct params to deployChange and client on modify', async () => {
      const id = 2
      const clonedBeforeApp = app.clone()
      const clonedAfterApp = app.clone()
      clonedAfterApp.value.settings = { name: 'My App - Updated', title: 'My App - Updated' }
      clonedBeforeApp.value.id = id
      clonedAfterApp.value.id = id
      mockDeployChange.mockImplementation(async () => ({ id }))
      const res = await filter.deploy([{ action: 'modify', data: { before: clonedBeforeApp, after: clonedAfterApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedBeforeApp, after: clonedAfterApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'modify', data: { before: clonedBeforeApp, after: clonedAfterApp } },
      ])
    })
    it('should return error if deployChange failed', async () => {
      const clonedApp = app.clone()
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should return error if client request failed', async () => {
      const id = 2
      const clonedApp = app.clone()
      const expectedClonedApp = app.clone()
      expectedClonedApp.value.id = id
      mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockImplementation(async () => {
        throw createSaltoElementError({
          message: 'err',
          severity: 'Error',
          elemID: clonedApp.elemID,
        })
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: expectedClonedApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(mockGet).toHaveBeenCalledWith({
        url: '/api/v2/apps/job_statuses/123',
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should return error if job status is failed', async () => {
      const id = 2
      const clonedApp = app.clone()
      const expectedClonedApp = app.clone()
      expectedClonedApp.value.id = id
      mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockResolvedValue({ status: 200, data: { status: 'failed' } })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: expectedClonedApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(mockGet).toHaveBeenCalledWith({
        url: '/api/v2/apps/job_statuses/123',
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should prefill missing fields', async () => {
      const id = 2
      const clonedApp = app.clone()
      const expectedClonedApp = app.clone()
      expectedClonedApp.value.settings.fourth_field = 123
      expectedClonedApp.value.settings.last_field = '12345'
      expectedClonedApp.value.id = id
      mockDeployChange.mockImplementation(async () => ({ id, pending_job_id: '123' }))
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/apps/job_statuses/123') {
          return { status: 200, data: { status: 'failed' } }
        }
        if (params.url === '/api/support/apps/1/installations/new') {
          return {
            status: 200,
            data: {
              installation: {
                settings: [
                  { key: 'name', secure: false, required: true, type: 'text' },
                  { key: 'title', secure: false, required: true, type: 'number' },
                  { key: 'third_field', secure: false, required: false, type: 'text' },
                  { key: 'fourth_field', secure: true, required: true, type: 'number' },
                  { key: 'last_field', secure: true, required: true, type: 'text' },
                ],
              },
            },
          }
        }
        throw new Error('Err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: expectedClonedApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(mockGet).toHaveBeenCalledWith({
        url: '/api/v2/apps/job_statuses/123',
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if create did not return job id', async () => {
      const id = 2
      const clonedApp = app.clone()
      const expectedClonedApp = app.clone()
      expectedClonedApp.value.id = id
      mockDeployChange.mockImplementation(async () => ({ id }))
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockResolvedValue({ status: 200, data: { status: 'failed' } })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedApp } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: expectedClonedApp } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['app', 'settings.title', 'settings_objects'],
      })
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
