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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZENDESK_SUPPORT } from '../../src/constants'
import filterCreator, { WEBHOOK_TYPE_NAME, AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA } from '../../src/filters/webhook'

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

describe('webhook filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const webhook = new InstanceElement(
    'test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, WEBHOOK_TYPE_NAME) }),
    {
      name: 'test',
      description: 'desc',
      status: 'active',
      subscriptions: [
        'conditional_ticket_events',
      ],
      endpoint: 'https://www.example.com/token',
      http_method: 'GET',
      request_format: 'json',
      authentication: {
        type: 'basic_auth',
        add_position: 'header',
      },
    },
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
  describe('deploy', () => {
    it('should pass the correct params to deployChange on create - basic_auth', async () => {
      const id = 2
      const clonedWebhook = webhook.clone()
      const deployedWebhook = webhook.clone()
      deployedWebhook.value.authentication.data = AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[
        deployedWebhook.value.authentication.type
      ]
      deployedWebhook.value.id = id
      mockDeployChange.mockImplementation(async () => ({ webhook: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: deployedWebhook } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: clonedWebhook } }])
    })
    it('should pass the correct params to deployChange on create - no auth', async () => {
      const id = 2
      const clonedWebhook = webhook.clone()
      delete clonedWebhook.value.authentication
      const deployedWebhook = clonedWebhook.clone()
      deployedWebhook.value.id = id
      mockDeployChange.mockImplementation(async () => ({ webhook: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: deployedWebhook } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: clonedWebhook } }])
    })

    it('should pass the correct params to deployChange on update - changed auth', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.authentication.type = 'bearer_token'
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      deployedWebhookAfter.value.authentication.data = AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[
        deployedWebhookAfter.value.authentication.type
      ]
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          {
            action: 'modify',
            data: { before: clonedWebhookBefore, after: clonedWebhookAfter },
          },
        ])
    })
    it('should pass the correct params to deployChange on update - auth was not changed', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.description = 'edited'
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      delete deployedWebhookAfter.value.authentication
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          {
            action: 'modify',
            data: { before: clonedWebhookBefore, after: clonedWebhookAfter },
          },
        ])
    })

    it('should pass the correct params to deployChange on update - auth was deleted', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      delete clonedWebhookAfter.value.authentication
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      deployedWebhookAfter.value.authentication = null
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          {
            action: 'modify',
            data: { before: clonedWebhookBefore, after: deployedWebhookAfter },
          },
        ])
    })

    it('should not handle remove changes', async () => {
      const id = 2
      const clonedWebhook = webhook.clone()
      clonedWebhook.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const clonedWebhook = webhook.clone()
      const deployedWebhook = webhook.clone()
      deployedWebhook.value.authentication.data = AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[
        deployedWebhook.value.authentication.type
      ]
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: deployedWebhook } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if change has unknown auth type', async () => {
      const id = 2
      const clonedWebhook = webhook.clone()
      delete clonedWebhook.value.authentication.type
      mockDeployChange.mockImplementation(async () => ({ webhook: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
