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
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { BuiltinTypes, ElemID, InstanceElement, ModificationChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockClient } from './utils'
import OktaClient from '../src/client/client'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, NETWORK_ZONE_TYPE_NAME, OKTA } from '../src/constants'
import { defaultDeployChange, defaultDeployWithStatus, deployStatusChange, getOktaError } from '../src/deployment'
import { DEFAULT_API_DEFINITIONS, OktaSwaggerApiConfig } from '../src/config'

describe('deployment.ts', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  let instance: InstanceElement
  let instance2: InstanceElement
  const type = new ObjectType({
    elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.SERVICE_ID },
    },
  })

  beforeEach(() => {
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    instance = new InstanceElement('instance', type, { name: 'val' })
  })
  describe('defaultDeployChange', () => {
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
        const result = await defaultDeployChange(toChange({ after: instance }), client, DEFAULT_API_DEFINITIONS, [])
        expect(result).toEqual({
          id: '1',
          name: 'val',
          obj: { data: '123' },
        })
        expect(instance.value).toEqual({
          id: '1',
          name: 'val',
        })
        expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/groups/rules', { name: 'val' }, undefined)
      })

      it('should return throw error when deploy fails', async () => {
        mockConnection.post.mockRejectedValue(
          new clientUtils.HTTPError('message', {
            status: 400,
            data: {
              errorSummary: 'some okta error',
              errorCauses: [{ errorSummary: 'cause1' }, { errorSummary: 'cause2' }],
            },
          }),
        )
        await expect(() =>
          defaultDeployChange(toChange({ after: instance }), client, DEFAULT_API_DEFINITIONS),
        ).rejects.toThrow(new Error('some okta error. More info: cause1,cause2 (status code: 400)'))
      })
    })

    describe('modification changes', () => {
      beforeEach(() => {
        instance.value.id = '1'
        instance2 = new InstanceElement('instance', type, { id: '1', name: 'changed val' })
      })
      it('successful deploy should return response', async () => {
        mockConnection.put.mockResolvedValueOnce({
          status: 200,
          data: {
            id: '1',
            name: 'changed val',
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
        const result = await defaultDeployChange(toChange({ before: instance }), client, DEFAULT_API_DEFINITIONS, [])
        expect(result).toEqual({})
        expect(mockConnection.delete).toHaveBeenCalledWith('/api/v1/groups/rules/1', { data: undefined })
      })
      it('should mark removal as success if request returned with 404', async () => {
        mockConnection.delete.mockRejectedValueOnce(
          new clientUtils.HTTPError('message', {
            status: 404,
            data: {},
          }),
        )
        const result = await defaultDeployChange(toChange({ before: instance }), client, DEFAULT_API_DEFINITIONS)
        expect(result).toEqual(undefined)
        expect(mockConnection.delete).toHaveBeenCalledWith('/api/v1/groups/rules/1', { data: undefined })
      })
    })
  })

  describe('defaultDeployWithStatus', () => {
    describe('addition changes', () => {
      const ruleInstance = new InstanceElement('test', type, {
        name: 'group rule',
        status: 'ACTIVE',
      })
      it('Should update status if instance was created by default with another status', async () => {
        mockConnection.post
          .mockResolvedValueOnce({
            status: 204,
            data: {
              id: '123',
              status: 'INACTIVE',
            },
          })
          .mockResolvedValueOnce({
            status: 204,
            data: {},
          })
        await defaultDeployWithStatus(toChange({ after: ruleInstance.clone() }), client, DEFAULT_API_DEFINITIONS, [])
        expect(mockConnection.post).toHaveBeenNthCalledWith(
          1,
          '/api/v1/groups/rules',
          { name: 'group rule' },
          undefined,
        )
        expect(mockConnection.post).toHaveBeenNthCalledWith(
          2,
          '/api/v1/groups/rules/123/lifecycle/activate',
          {},
          undefined,
        )
      })
      it('Should not try to change status if response does not contain status', async () => {
        mockConnection.post.mockResolvedValueOnce({
          status: 204,
          data: {
            id: '123',
          },
        })
        await defaultDeployWithStatus(toChange({ after: ruleInstance.clone() }), client, DEFAULT_API_DEFINITIONS, [])
        expect(mockConnection.post).toHaveBeenCalledTimes(1)
        expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/groups/rules', { name: 'group rule' }, undefined)
      })
      it("Should not try to change status if change doesn't have status field", async () => {
        mockConnection.post.mockResolvedValueOnce({
          status: 204,
          data: {
            id: '123',
          },
        })
        const groupInstance = new InstanceElement(
          'group',
          new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) }),
          { name: 'group' },
        )
        await defaultDeployWithStatus(toChange({ after: groupInstance.clone() }), client, DEFAULT_API_DEFINITIONS, [])
        expect(mockConnection.post).toHaveBeenCalledTimes(1)
        expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/groups', { name: 'group' }, undefined)
      })
    })

    describe('modification changes', () => {
      it('Should change status if the status changed', async () => {
        instance.value.status = 'ACTIVE'
        instance2.value.status = 'INACTIVE'
        mockConnection.post.mockResolvedValue({
          status: 204,
          data: {},
        })
        mockConnection.put.mockResolvedValue({
          status: 200,
          data: {
            id: '1',
            name: 'changed val',
            status: 'INACTIVE',
          },
        })
        const result = await defaultDeployWithStatus(
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
        expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/groups/rules/1/lifecycle/deactivate', {}, undefined)
        expect(mockConnection.put).toHaveBeenCalledWith(
          '/api/v1/groups/rules/1',
          { id: '1', name: 'changed val' },
          undefined,
        )
      })
    })
    describe('removal changes', () => {
      it('should deactivate change before removal for relevant changes', async () => {
        const zoneType = new ObjectType({ elemID: new ElemID(OKTA, NETWORK_ZONE_TYPE_NAME) })
        const zoneInstance = new InstanceElement('zone', zoneType, { id: 'a', name: 'zone', status: 'ACTIVE' })
        mockConnection.post.mockResolvedValue({
          status: 204,
          data: {},
        })
        mockConnection.delete.mockResolvedValue({ status: 200, data: {} })
        await defaultDeployWithStatus(toChange({ before: zoneInstance }), client, DEFAULT_API_DEFINITIONS, [])
        expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/zones/a/lifecycle/deactivate', {}, undefined)
        expect(mockConnection.delete).toHaveBeenCalledWith('/api/v1/zones/a', { data: undefined })
      })
    })
  })

  describe('getOktaError', () => {
    it("should return the correct error message when the error is in Okta's format", async () => {
      const elemID = new ElemID(OKTA, GROUP_RULE_TYPE_NAME, 'instance', 'name')
      const errorData = {
        errorSummary: 'error summary',
        errorCauses: [{ errorSummary: 'nested error summary 1' }, { errorSummary: 'nested error summary 1' }],
      }
      const error = new clientUtils.HTTPError('error', { data: errorData, status: 404 })
      const oktaError = getOktaError(elemID, error)
      expect(oktaError.message).toEqual(
        'error summary. More info: nested error summary 1,nested error summary 1 (status code: 404)',
      )
    })
  })

  describe('deployStatusChange', () => {
    const someType = new ObjectType({ elemID: new ElemID(OKTA, 'SomeType') })
    const instanceA = new InstanceElement('status', someType, { status: 'ACTIVE', id: '123' })
    const instanceB = instanceA.clone()
    instanceB.value.status = 'INACTIVE'
    const apiDefsWithStatusChange = {
      ...DEFAULT_API_DEFINITIONS,
      types: {
        SomeType: {
          deployRequests: {
            activate: {
              url: '/api/v1/apps/{applicationId}/lifecycle/activate',
              method: 'post',
              urlParamsToFields: {
                applicationId: 'id',
              },
            },
            deactivate: {
              url: '/api/v1/apps/{applicationId}/lifecycle/deactivate',
              method: 'post',
              urlParamsToFields: {
                applicationId: 'id',
              },
            },
          },
        },
      },
    }
    it('should do nothing if "activated" or "deactivated" endpoint are missing', async () => {
      await deployStatusChange(
        toChange({ before: instanceA, after: instanceB }) as ModificationChange<InstanceElement>,
        client,
        DEFAULT_API_DEFINITIONS,
        'activate',
      )
      await deployStatusChange(
        toChange({ before: instanceA, after: instanceB }) as ModificationChange<InstanceElement>,
        client,
        DEFAULT_API_DEFINITIONS,
        'deactivate',
      )
      expect(mockConnection.post).toHaveBeenCalledTimes(0)
    })
    it('should deactivate instance if action is `deactivate`', async () => {
      await deployStatusChange(
        toChange({ before: instanceA, after: instanceB }) as ModificationChange<InstanceElement>,
        client,
        apiDefsWithStatusChange as OktaSwaggerApiConfig,
        'deactivate',
      )
      expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/apps/123/lifecycle/deactivate', {}, undefined)
    })

    it('should activate instance if action is `activate`', async () => {
      await deployStatusChange(
        toChange({ before: instanceB, after: instanceA }) as ModificationChange<InstanceElement>,
        client,
        apiDefsWithStatusChange as OktaSwaggerApiConfig,
        'activate',
      )
      expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/apps/123/lifecycle/activate', {}, undefined)
    })
  })
})
