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
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { mockClient } from '../utils'
import { DeployUrls, deployWithJspEndpoints } from '../../src/deployment/jsp_deployment'
import JiraClient from '../../src/client/client'
import { JIRA, JSP_API_HEADERS, PRIVATE_API_HEADERS } from '../../src/constants'

describe('jsp_deployment', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let urls: DeployUrls
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli

    urls = {
      addUrl: 'https://jira.com/rest/api/2/add',
      modifyUrl: 'https://jira.com/rest/api/2/modify',
      removeUrl: 'https://jira.com/rest/api/2/remove',
      queryUrl: 'https://jira.com/rest/api/2/query',
    }

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'test'),
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        value: 'val',
      }
    )
  })

  describe('on additions', () => {
    it('successful deploy should add id to the element', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          value: 'val',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints(
        [toChange({ after: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(instance.value).toEqual({
        id: '1',
        value: 'val',
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
          value: 'val',
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
      const results = await deployWithJspEndpoints(
        [toChange({ after: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When the created object is different should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          value: 'val2',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints(
        [toChange({ after: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When failed to query the instances in the service should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 400,
        data: {},
      })
      const results = await deployWithJspEndpoints(
        [toChange({ after: instance })],
        client,
        urls,
      )
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
          value: 'val',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance, after: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(0)
      expect(results.appliedChanges).toHaveLength(1)

      expect(instance.value).toEqual({
        id: '1',
        value: 'val',
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
          value: 'val',
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
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance, after: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When the modified object is different should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          id: '1',
          value: 'val2',
          self: 'someSelf',
        }],
      })
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance, after: instance })],
        client,
        urls,
      )
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
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance })],
        client,
        urls,
      )
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
          value: 'val',
          id: '1',
          confirm: 'true',
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
          value: 'val',
        }],
      })
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When failed to query the instances in the service should return an error', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 400,
        data: {},
      })
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance })],
        client,
        urls,
      )
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })

    it('When there is not url for removal', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 400,
        data: {},
      })
      const results = await deployWithJspEndpoints(
        [toChange({ before: instance })],
        client,
        _.omit(urls, 'removeUrl'),
      )
      expect(results.errors).toHaveLength(1)
      expect(results.appliedChanges).toHaveLength(0)
    })
  })
})
