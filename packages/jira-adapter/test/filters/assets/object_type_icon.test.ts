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
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { InstanceElement, Element, StaticFile, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { AuthenticatedAPIConnection } from '@salto-io/adapter-components/src/client'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import objectTypeIconFilter from '../../../src/filters/assets/object_type_icon'
import { OBJECT_TYPE_ICON_TYPE } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'
import * as connection from '../../../src/client/connection'
import * as clientModule from '../../../src/client/client'
import { FilterResult } from '../../../src/filter'

jest.mock('../../../src/client/connection')
const mockedConnection = jest.mocked(connection)
describe('object type icon filter', () => {
  let client: JiraClient
  let mockGet: jest.SpyInstance
  let mockPost: jest.SpyInstance
  let mockConstructClient: jest.SpyInstance
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch', FilterResult>
  let filter: FilterType
  let elements: Element[]
  const objectTypeIconType = createEmptyType(OBJECT_TYPE_ICON_TYPE)
  let objectTypeIconInstance: InstanceElement
  const content = Buffer.from('test')
  const adapterContext: Values = {}
  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  config.fetch.enableJSM = true
  config.fetch.enableJSMPremium = true

  beforeEach(async () => {
    const { client: cli } = mockClient(false)
    client = cli
    filter = objectTypeIconFilter(getFilterParams({ client, config, adapterContext })) as typeof filter
    mockGet = jest.spyOn(client, 'get')
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      objectTypeIconInstance = new InstanceElement('objectType1', objectTypeIconType, {
        name: 'objectTypeIconName',
        id: 12,
      })
      elements = [objectTypeIconInstance]
    })

    it('should add object type icon content', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        if (params.url === '/gateway/api/jsm/insight/workspace/workspaceId/v1/icon/12/icon.png') {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(objectTypeIconInstance.value).toEqual({
        name: 'objectTypeIconName',
        id: 12,
        icon: new StaticFile({
          filepath: 'jira/ObjectTypeIcon/objectTypeIconName.png',
          encoding: 'binary',
          content,
        }),
      })
    })
    it('should not add icon content if it is a bad response', async () => {
      mockGet.mockClear()
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        if (params.url === '/gateway/api/jsm/insight/workspace/workspaceId/v1/icon/12/icon.png') {
          return {
            status: 200,
            data: {},
          }
        }
        throw new Error('Err')
      })
      await filter.onFetch(elements)
      expect(objectTypeIconInstance.value.icon).toBeUndefined()
    })
    it('should not add object type icon if error has been thrown from client', async () => {
      mockGet.mockClear()
      mockGet.mockImplementation(() => {
        throw new clientUtils.HTTPError('Failed', { data: {}, status: 403 })
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(objectTypeIconInstance.value.icon).toBeUndefined()
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual('Failed to fetch object type icons because workspaceId is undefined')
    })
  })
  describe('on deploy', () => {
    beforeEach(async () => {
      mockedConnection.createLogoConnection.mockReturnValue({
        login: () => Promise.resolve({} as AuthenticatedAPIConnection),
      })
      mockPost = jest.spyOn(client, 'post')
      objectTypeIconInstance = new InstanceElement('objectType1', objectTypeIconType, {
        name: 'objectTypeIconName',
        id: 12,
        icon: new StaticFile({
          filepath: 'jira/ObjectTypeIcon/objectTypeIconName.png',
          encoding: 'binary',
          content,
        }),
      })
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        if (params.url === '/gateway/api/jsm/assets/workspace/workspaceId/v1/icon/token-for-uploading-icon') {
          return {
            status: 200,
            data: {
              mediaJwtToken: 'token',
            },
          }
        }
        throw new Error('Err')
      })
      mockConstructClient = jest.spyOn(clientModule, 'default')
      mockConstructClient.mockReturnValue(client)
      adapterContext.authorizationToken = undefined
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should add object type icon to elements', async () => {
      mockPost.mockImplementation(params => {
        if (
          params.url === '/file/binary?collection=insight_workspaceId_icons&name=objectTypeIconName.png&deletable=true'
        ) {
          return {
            status: 200,
            data: {
              data: {
                id: '101',
              },
            },
          }
        }
        if (params.url === 'gateway/api/jsm/assets/workspace/workspaceId/v1/icon/create') {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(objectTypeIconInstance.value.id).toEqual('101')
    })
    it('should add object type icon to elements when adapterContext.authorizationToken is set', async () => {
      mockPost.mockImplementation(params => {
        if (
          params.url === '/file/binary?collection=insight_workspaceId_icons&name=objectTypeIconName.png&deletable=true'
        ) {
          return {
            status: 200,
            data: {
              data: {
                id: '101',
              },
            },
          }
        }
        if (params.url === 'gateway/api/jsm/assets/workspace/workspaceId/v1/icon/create') {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        if (params.url === '/gateway/api/jsm/assets/workspace/workspaceId/v1/icon/token-for-uploading-icon') {
          throw new Error("Wasn't supposed to be called")
        }
        throw new Error('Err')
      })
      adapterContext.authorizationToken = 'token'
      filter = objectTypeIconFilter(getFilterParams({ client, config, adapterContext })) as typeof filter
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(objectTypeIconInstance.value.id).toEqual('101')
    })
    it('should not deploy icon if !isIconCreationResponseScheme response from post', async () => {
      mockPost.mockImplementation(params => {
        if (
          params.url === '/file/binary?collection=insight_workspaceId_icons&name=objectTypeIconName.png&deletable=true'
        ) {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        if (params.url === 'gateway/api/jsm/assets/workspace/workspaceId/v1/icon/create') {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should not deploy icon if !isIconResponse response from post', async () => {
      mockPost.mockImplementation(params => {
        if (
          params.url === '/file/binary?collection=insight_workspaceId_icons&name=objectTypeIconName.png&deletable=true'
        ) {
          return {
            status: 200,
            data: {
              data: {
                id: '101',
              },
            },
          }
        }
        if (params.url === 'gateway/api/jsm/assets/workspace/workspaceId/v1/icon/create') {
          return {
            status: 404,
          }
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should not deploy icon if !isIconResponse response and it is clientUtils.HTTPError', async () => {
      mockPost.mockImplementation(params => {
        if (
          params.url === '/file/binary?collection=insight_workspaceId_icons&name=objectTypeIconName.png&deletable=true'
        ) {
          return {
            status: 200,
            data: {
              data: {
                id: '101',
              },
            },
          }
        }
        if (params.url === 'gateway/api/jsm/assets/workspace/workspaceId/v1/icon/create') {
          throw new clientUtils.HTTPError('failed', { data: {}, status: 403 })
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should not deploy icon if content is undefined', async () => {
      mockPost.mockImplementation(params => {
        if (
          params.url === '/file/binary?collection=insight_workspaceId_icons&name=objectTypeIconName.png&deletable=true'
        ) {
          return {
            status: 200,
            data: {
              data: {
                id: '101',
              },
            },
          }
        }
        if (params.url === 'gateway/api/jsm/assets/workspace/workspaceId/v1/icon/create') {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      objectTypeIconInstance = new InstanceElement('objectType1', objectTypeIconType, {
        name: 'objectTypeIconName',
        id: 12,
        icon: undefined,
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'Error: Failed to deploy icon to Jira object type: Error: Failed to fetch attachment content from icon objectType1',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should not call anything if no addition change of object type icon', async () => {
      const afterIconInstance = objectTypeIconInstance.clone()
      afterIconInstance.value.icon = new StaticFile({
        filepath: 'jira/objectTypeIcon/changed.png',
        encoding: 'binary',
        content: Buffer.from('changes!'),
      })
      const res = await filter.deploy([
        { action: 'modify', data: { before: objectTypeIconInstance, after: afterIconInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockPost).toHaveBeenCalledTimes(0)
      expect(mockGet).toHaveBeenCalledTimes(0)
    })
    it('should not deploy icon if failed to get workspaceId', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('Error')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'The following changes were not deployed, due to error with the workspaceId: jira.ObjectTypeIcon.instance.objectType1',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockPost).toHaveBeenCalledTimes(0)
    })
    it('should not deploy icon if failed to get authentication icon', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        return {
          status: 403,
        }
      })
      const res = await filter.deploy([{ action: 'add', data: { after: objectTypeIconInstance } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockPost).toHaveBeenCalledTimes(0)
    })
  })
})
