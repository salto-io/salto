/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { client as clientUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { mockClient } from '../utils'
import { deployWithJspEndpoints } from '../../src/deployment/jsp_deployment'
import { PRIVATE_API_HEADERS, JSP_API_HEADERS } from '../../src/client/headers'
import JiraClient from '../../src/client/client'
import { JIRA } from '../../src/constants'
import { JspUrls } from '../../src/config/config'

describe('jsp_deployment', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let urls: JspUrls
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli

    urls = {
      add: 'https://jira.com/rest/api/2/add',
      modify: 'https://jira.com/rest/api/2/modify',
      remove: 'https://jira.com/rest/api/2/remove',
      query: 'https://jira.com/rest/api/2/query',
    }

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'test'),
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        name: 'val',
      }
    )
  })

  describe('on additions', () => {
    it('successful deploy should add id to the element', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          name: 'val',
          self: 'someSelf',
          ignored: 'ignored',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls,
        fieldsToIgnore: ['ignored'],
      })
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(instance.value).toEqual({
        id: '1',
        name: 'val',
      })
      expect(mockConnection.get).toHaveBeenCalledWith(
        'https://jira.com/rest/api/2/query',
        {
          headers: PRIVATE_API_HEADERS,
        }
      )

      expect(mockConnection.post).toHaveBeenCalledWith(
        'https://jira.com/rest/api/2/add',
        new URLSearchParams({
          name: 'val',
        }),
        {
          headers: JSP_API_HEADERS,
        }
      )
    })

    it('should use dataField', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          inner: [{
            id: '1',
            name: 'val',
            self: 'someSelf',
          }],
        },
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls: {
          ...urls,
          dataField: 'inner',
        },
      })
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(instance.value).toEqual({
        id: '1',
        name: 'val',
      })
    })

    it('should use getNameFunction', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          val: 'val',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls,
        getNameFunction: values => values.val,
      })
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(instance.value).toEqual({
        id: '1',
        name: 'val',
      })
    })

    it('should return an error when there is no name in the service values', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          val: 'val',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When no id is returned should throw an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When the created object is different should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          name: 'val2',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When failed to query the instances in the service should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 400,
        data: {},
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })
  })

  describe('on modification', () => {
    beforeEach(() => {
      instance.value.id = '1'
    })
    it('successful deploy should return the change', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          name: 'val',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance, after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(instance.value).toEqual({
        id: '1',
        name: 'val',
      })
      expect(mockConnection.get).toHaveBeenCalledWith(
        'https://jira.com/rest/api/2/query',
        {
          headers: PRIVATE_API_HEADERS,
        }
      )

      expect(mockConnection.post).toHaveBeenCalledWith(
        'https://jira.com/rest/api/2/modify',
        new URLSearchParams({
          name: 'val',
          id: '1',
        }),
        {
          headers: JSP_API_HEADERS,
        }
      )
    })

    it('When no id is returned should throw an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance, after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When the modified object is different should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          name: 'val2',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance, after: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When there is not url for modification, should throw', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          name: 'val',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance, after: instance })],
        client,
        urls: _.omit(urls, 'modify'),
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })
  })

  describe('on removal', () => {
    beforeEach(() => {
      instance.value.id = '1'
    })
    it('successful deploy should return the change', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(mockConnection.get).toHaveBeenCalledWith(
        'https://jira.com/rest/api/2/query',
        {
          headers: PRIVATE_API_HEADERS,
        }
      )

      expect(mockConnection.post).toHaveBeenCalledWith(
        'https://jira.com/rest/api/2/remove',
        new URLSearchParams({
          name: 'val',
          id: '1',
          confirm: 'true',
          confirmed: 'true',
        }),
        {
          headers: JSP_API_HEADERS,
        }
      )
    })

    it('When there is an id in the service should throw an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          name: 'val',
        }],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('Should throw when there is not query url and no queryFunction', async () => {
      const res = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls: _.omit(urls, 'query'),
      })

      expect(res.errors).toHaveLength(1)
    })

    it('Should use queryFunction when passed', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 400,
        data: {},
      })

      const res = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls,
        queryFunction: async () => [{ id: '1' }],
      })

      expect(res.errors).toHaveLength(0)
    })

    it('When failed to query the instances in the service should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 400,
        data: {},
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When there is no url for removal should throw an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls: _.omit(urls, 'remove'),
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('Should not throw when the request fail and the instance is already deleted', async () => {
      mockConnection.post.mockRejectedValue(new clientUtils.HTTPError('message', {
        status: 404,
        data: {},
      }))
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)
    })
    it('Should throw when the request fail with 500', async () => {
      mockConnection.post.mockRejectedValue(new clientUtils.HTTPError('message', {
        status: 500,
        data: {},
      }))
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [],
      })
      const results = await deployWithJspEndpoints({
        changes: [toChange({ before: instance })],
        client,
        urls,
      })
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })
  })
})
