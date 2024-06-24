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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, StaticFile, toChange } from '@salto-io/adapter-api'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import issueTypeFilter from '../../src/filters/issue_type'
import JiraClient from '../../src/client/client'

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
describe('issueTypeFilter', () => {
  let instance: InstanceElement
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  let client: JiraClient
  const content = Buffer.from('test')
  const issueType = new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_TYPE_NAME),
    fields: {
      issueTypeId: { refType: BuiltinTypes.STRING },
      screenSchemeId: { refType: BuiltinTypes.STRING },
    },
  })
  beforeEach(async () => {
    const { client: cli, paginator } = mockClient(true)
    client = cli

    filter = issueTypeFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
    instance = new InstanceElement('instance', issueType, {
      subtask: true,
    })
  })
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('onFetch', () => {
    it('should convert sub task to the right hierarchy', async () => {
      await filter.onFetch?.([instance])
      expect(instance.value.hierarchyLevel).toBe(-1)
      expect(instance.value.subtask).toBeUndefined()
    })

    it('should convert task to the right hierarchy', async () => {
      instance.value.subtask = false
      await filter.onFetch?.([instance])
      expect(instance.value.hierarchyLevel).toBe(0)
      expect(instance.value.subtask).toBeUndefined()
    })

    it('when cloud should only delete subtask', async () => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      await filter.onFetch?.([instance])
      expect(instance.value.hierarchyLevel).toBeUndefined()
      expect(instance.value.subtask).toBeUndefined()
    })
    describe('fetch issue type icon', () => {
      let mockGet: jest.SpyInstance
      beforeEach(() => {
        const { client: cli, paginator } = mockClient(false)
        client = cli

        filter = issueTypeFilter(
          getFilterParams({
            client,
            paginator,
          }),
        ) as typeof filter
        mockGet = jest.spyOn(client, 'get')
        instance = new InstanceElement('instance', issueType, {
          name: 'instanceName',
          description: 'instanceDescription',
          avatarId: 1,
        })
      })
      afterEach(() => {
        mockGet.mockClear()
      })
      it('should set icon content', async () => {
        const anotherInstance = instance.clone()
        anotherInstance.value.name = 'anotherInstance'
        mockGet.mockImplementation(params => {
          if (params.url === '/rest/api/3/universal_avatar/view/type/issuetype/avatar/1') {
            return {
              status: 200,
              data: content,
            }
          }
          throw new Error('Err')
        })
        await filter.onFetch?.([instance, anotherInstance])
        expect(instance.value.avatar).toBeDefined()
        expect(instance.value.avatar).toEqual(
          new StaticFile({
            filepath: 'jira/IssueType/instanceName.png',
            encoding: 'binary',
            content,
          }),
        )
        expect(anotherInstance.value.avatar).toBeDefined()
        expect(anotherInstance.value.avatar).toEqual(
          new StaticFile({
            filepath: 'jira/IssueType/anotherInstance.png',
            encoding: 'binary',
            content,
          }),
        )
        expect(mockGet).toHaveBeenCalledTimes(2)
      })
      it('should set icon content when its a string', async () => {
        mockGet.mockImplementation(params => {
          if (params.url === '/rest/api/3/universal_avatar/view/type/issuetype/avatar/1') {
            return {
              status: 200,
              data: 'a string, not a buffer.',
            }
          }
          throw new Error('Err')
        })
        await filter.onFetch?.([instance])
        expect(instance.value.avatar).toBeDefined()
        expect(instance.value.avatar).toEqual(
          new StaticFile({
            filepath: 'jira/IssueType/instanceName.png',
            encoding: 'binary',
            content: Buffer.from('a string, not a buffer.'),
          }),
        )
      })

      it('should not set icon content if avatarId is undefined', async () => {
        instance.value.avatarId = undefined
        await filter.onFetch?.([instance])
        expect(instance.value.avatar).toBeUndefined()
      })
      it('should not set icon content and add error if failed to fetch icon due to an http error', async () => {
        mockGet.mockImplementation(() => {
          throw new clientUtils.HTTPError('500 Internal request', {
            status: 500,
            data: {
              errorMessages: ['The content was not found.'],
            },
          })
        })
        const res = await filter.onFetch?.([instance])
        expect(instance.value.avatar).toBeUndefined()
        expect(res).toEqual({
          errors: [
            {
              message: 'Failed to fetch attachment content from Jira API. error: 500 Internal request',
              severity: 'Warning',
            },
          ],
        })
      })
      it('should not set icon content and add error if failed to fetch icon due to a bad contnet format', async () => {
        mockGet.mockImplementation(params => {
          if (params.url === '/rest/api/3/universal_avatar/view/type/issuetype/avatar/1') {
            return {
              status: 200,
              data: 55 as unknown as Buffer,
            }
          }
          throw new Error('Err')
        })
        const res = await filter.onFetch?.([instance])
        expect(instance.value.avatar).toBeUndefined()
        expect(res).toEqual({
          errors: [
            {
              message:
                'Failed to fetch attachment content from Jira API. error: Error: Failed to fetch attachment content, response is not a buffer.',
              severity: 'Warning',
            },
          ],
        })
      })
      it('should not set icon content and add error if failed to fetch icon due to 404 response', async () => {
        mockGet.mockImplementation(params => {
          if (params.url === '/rest/api/3/universal_avatar/view/type/issuetype/avatar/1') {
            return {
              status: 404,
              data: {},
            }
          }
          throw new Error('Err')
        })
        const res = await filter.onFetch?.([instance])
        expect(instance.value.avatar).toBeUndefined()
        expect(res).toEqual({
          errors: [
            {
              message:
                'Failed to fetch attachment content from Jira API. error: Error: Failed to fetch issue type icon. It might be corrupted. To fix this, upload a new icon in your jira instance.',
              severity: 'Warning',
            },
          ],
        })
      })
    })
  })
  describe('preDeploy', () => {
    it('should convert subtask hierarchy level to type', async () => {
      instance.value = {
        hierarchyLevel: -1,
      }
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        type: 'subtask',
      })
    })

    it('should convert task hierarchy level to type', async () => {
      instance.value = {
        hierarchyLevel: 0,
      }
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        type: 'standard',
      })
    })

    it('should do nothing if cloud', async () => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      instance.value = {
        hierarchyLevel: 0,
      }
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        hierarchyLevel: 0,
      })
    })
  })

  describe('onDeploy', () => {
    it('should convert subtask type to hierarchy level', async () => {
      instance.value = {
        type: 'subtask',
      }
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        hierarchyLevel: -1,
      })
    })

    it('should convert task type to hierarchy level', async () => {
      instance.value = {
        type: 'standard',
      }
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        hierarchyLevel: 0,
      })
    })

    it('should do nothing if cloud', async () => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      instance.value = {
        type: 'standard',
      }
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        type: 'standard',
      })
    })
  })
  describe('deploy', () => {
    let mockPost: jest.SpyInstance
    let mockPut: jest.SpyInstance
    beforeEach(() => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      instance = new InstanceElement('instance', issueType, {
        name: 'instanceName',
        description: 'instanceDescription',
        avatarId: 1,
        id: 3,
        avatar: new StaticFile({
          filepath: 'jira/ObjectTypeIcon/objectTypeIconName.png',
          encoding: 'binary',
          content,
        }),
      })
      mockPost = jest.spyOn(client, 'post')
      mockPut = jest.spyOn(client, 'put')
      mockDeployChange.mockImplementation(async () => ({}))
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should deploy addition of issueType with avatar', async () => {
      mockPost.mockImplementation(async params => {
        if (params.url === '/rest/api/3/universal_avatar/type/issuetype/owner/3') {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: instance } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockDeployChange).toHaveBeenCalledTimes(1) // For adding the issueType
      expect(mockPost).toHaveBeenCalledTimes(1) // For loading the icon
      expect(mockPost).toHaveBeenCalledWith({
        url: '/rest/api/3/universal_avatar/type/issuetype/owner/3',
        data: content,
        headers: {
          'Content-Type': 'image/png',
          'X-Atlassian-Token': 'no-check',
        },
      })
      expect(instance.value.avatarId).toEqual(101)
      expect(mockPut).toHaveBeenCalledTimes(1) // For updating the instance with the avatarId
      expect(mockPut).toHaveBeenCalledWith({
        url: '/rest/api/3/issuetype/3',
        data: {
          avatarId: 101,
        },
        undefined,
      })
    })
    it('should deploy addition of issueType without avatar', async () => {
      delete instance.value.avatar
      mockPost.mockImplementation(async params => {
        if (params.url === '/rest/api/3/universal_avatar/type/issuetype/owner/3') {
          return {
            status: 200,
            data: {
              id: '101',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: instance } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockDeployChange).toHaveBeenCalledTimes(1) // For adding the issueType
      expect(mockPost).toHaveBeenCalledTimes(0) // For not loading the icon
      expect(mockPut).toHaveBeenCalledTimes(0) // For not updating the instance with the avatarId
    })
    it('should deploy modification of issueType with avatar', async () => {
      mockPost.mockImplementation(async params => {
        if (params.url === '/rest/api/3/universal_avatar/type/issuetype/owner/3') {
          return {
            status: 200,
            data: {
              id: '99',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      instance.value.avatarId = 101
      const instsnceAfter = instance.clone()
      instsnceAfter.value.avatar = new StaticFile({
        filepath: 'jira/issueTypeIcon/changed.png',
        encoding: 'binary',
        content: Buffer.from('more and more changes!'),
      })
      const res = await filter.deploy([{ action: 'modify', data: { before: instance, after: instsnceAfter } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledTimes(1) // For loading the icon
      expect(mockDeployChange).toHaveBeenCalledTimes(1) // For updating the issueType
    })
    it('should deploy modification of issueType without avatar', async () => {
      mockPost.mockImplementation(async params => {
        if (params.url === '/rest/api/3/universal_avatar/type/issuetype/owner/3') {
          return {
            status: 200,
            data: {
              id: '99',
            },
          }
        }
        throw new Error('Unexpected url')
      })
      instance.value.avatarId = 101
      const instsnceAfter = instance.clone()
      instsnceAfter.value.description = 'changed description'
      const res = await filter.deploy([{ action: 'modify', data: { before: instance, after: instsnceAfter } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledTimes(0) // For not loading the icon
      expect(mockDeployChange).toHaveBeenCalledTimes(1) // For updating the issueType
    })
    it('should not deploy issueType if !isIconResponse ', async () => {
      mockPost.mockImplementation(async () => ({
        status: 200,
        data: {},
      }))
      instance.value.avatarId = 101
      const instsnceAfter = instance.clone()
      instsnceAfter.value.avatar = new StaticFile({
        filepath: 'jira/issueTypeIcon/changed.png',
        encoding: 'binary',
        content: Buffer.from('more changes!'),
      })
      const res = await filter.deploy([{ action: 'modify', data: { before: instance, after: instsnceAfter } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'Error: Failed to deploy icon to Jira issue type: Failed to deploy icon to Jira issue type: Invalid response from Jira API',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockPost).toHaveBeenCalledTimes(1) // For loading the icon
      expect(mockDeployChange).toHaveBeenCalledTimes(0) // Since the icon response is invalid
    })
    it('should not do anything if client is data center', async () => {
      const { client: cli, paginator } = mockClient(true)
      client = cli

      filter = issueTypeFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      const res = await filter.deploy([{ action: 'add', data: { after: instance } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockPost).toHaveBeenCalledTimes(0)
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
    })
  })
})
