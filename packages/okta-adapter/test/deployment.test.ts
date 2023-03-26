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
import { mockClient } from './utils'
import OktaClient from '../src/client/client'
import { GROUP_RULE_TYPE_NAME, OKTA } from '../src/constants'
import { defaultDeployChange } from '../src/deployment'
import { DEFAULT_API_DEFINITIONS } from '../src/config'

describe('defaultDeployChange', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  let type: ObjectType
  let instance: InstanceElement
  let instance2: InstanceElement

  beforeEach(() => {
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli

    type = new ObjectType({
      elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME),
    })
    instance = new InstanceElement(
      'instance',
      type,
      { name: 'val' }
    )
  })

  describe('addition changes', () => {
    it('successful deploy should add id to the element', async () => {
      mockConnection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          id: '1',
          name: 'val',
          obj: { data: '123' },
        },
      })
      const result = await defaultDeployChange(
        toChange({ after: instance }),
        client,
        DEFAULT_API_DEFINITIONS,
        [],
      )
      expect(result).toEqual({
        id: '1',
        name: 'val',
        obj: { data: '123' },
      })
      expect(instance.value).toEqual({
        id: '1',
        name: 'val',
      })
      expect(mockConnection.post).toHaveBeenCalledWith(
        '/api/v1/groups/rules',
        { name: 'val' },
        undefined,
      )
    })

    it('should return throw error when deploy fails', async () => {
      mockConnection.post.mockRejectedValue(new clientUtils.HTTPError('message', {
        status: 400,
        data: {
          errorSummary: 'some okta error',
          errorCauses: [{ errorSummary: 'cause1' }, { errorSummary: 'cause2' }],
        },
      }))
      await expect(() => defaultDeployChange(
        toChange({ after: instance }),
        client,
        DEFAULT_API_DEFINITIONS,
      )).rejects.toThrow(new Error('Deployment of GroupRule instance instance failed with status code 400: some okta error. More info: cause1,cause2'))
    })
  })

  describe('modification changes', () => {
    beforeEach(() => {
      instance.value.id = '1'
      instance2 = new InstanceElement(
        'instance',
        type,
        { id: '1', name: 'changed val' },
      )
    })
    it('successful deploy should return response', async () => {
      mockConnection.put.mockResolvedValueOnce({
        status: 200,
        data: {
          id: '1', name: 'changed val',
        },
      })
      const result = await defaultDeployChange(
        toChange({ before: instance, after: instance2 }),
        client,
        DEFAULT_API_DEFINITIONS,
        [],
      )
      expect(result).toEqual({ id: '1', name: 'changed val' })
      expect(instance2.value).toEqual({
        id: '1',
        name: 'changed val',
      })
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/api/v1/groups/rules/1',
        { name: 'changed val', id: '1' },
        undefined,
      )
    })

    it('Should change status if the status changed', async () => {
      instance.value.status = 'ACTIVE'
      instance2.value.status = 'INACTIVE'
      mockConnection.post
        .mockResolvedValue({
          status: 204, data: {},
        })
      mockConnection.put
        .mockResolvedValue({
          status: 200,
          data: {
            id: '1',
            name: 'changed val',
            status: 'INACTIVE',
          },
        })
      const result = await defaultDeployChange(
        toChange({ before: instance, after: instance2 }),
        client,
        DEFAULT_API_DEFINITIONS,
        [],
      )
      expect(result).toEqual({
        id: '1',
        name: 'changed val',
        status: 'INACTIVE',
      })
      expect(mockConnection.post).toHaveBeenCalledWith(
        '/api/v1/groups/rules/1/lifecycle/deactivate',
        {},
        undefined,
      )
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/api/v1/groups/rules/1',
        { id: '1', name: 'changed val' },
        undefined,
      )
    })

    it('should return undefined if before and after values are equal', async () => {
      const result = await defaultDeployChange(
        toChange({ before: instance, after: instance }),
        client,
        DEFAULT_API_DEFINITIONS,
        [],
      )
      expect(result).toEqual(undefined)
      expect(mockConnection.put).not.toHaveBeenCalled()
    })
  })

  describe('removal changes', () => {
    beforeEach(() => {
      instance.value.id = '1'
    })
    it('successful deploy should return the response', async () => {
      mockConnection.delete.mockResolvedValueOnce({
        status: 200,
        data: {},
      })
      const result = await defaultDeployChange(
        toChange({ before: instance }),
        client,
        DEFAULT_API_DEFINITIONS,
        [],
      )
      expect(result).toEqual({})
      expect(mockConnection.delete).toHaveBeenCalledWith(
        '/api/v1/groups/rules/1',
        { id: '1', name: 'val' },
        undefined,
      )
    })
  })
})
