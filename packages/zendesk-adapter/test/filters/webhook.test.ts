/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  TemplateExpression,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { BRAND_TYPE_NAME, WEBHOOK_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator, { AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA } from '../../src/filters/webhook'
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

describe('webhook filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  const webhookType = new ObjectType({ elemID: new ElemID(ZENDESK, WEBHOOK_TYPE_NAME) })
  const webhook = new InstanceElement('webhook1', webhookType, {
    name: 'test',
    description: 'desc',
    status: 'active',
    subscriptions: ['conditional_ticket_events'],
    endpoint: 'https://www.example.com/token',
    http_method: 'GET',
    request_format: 'json',
    authentication: {
      type: 'basic_auth',
      add_position: 'header',
    },
  })
  const webhook4 = new InstanceElement('webhook4', webhookType, {
    name: 'test4',
    description: 'desc',
    status: 'active',
    subscriptions: ['conditional_ticket_events'],
    endpoint: 'https://otherSubdomain.com/token',
    http_method: 'GET',
    request_format: 'json',
    authentication: {
      type: 'basic_auth',
      add_position: 'header',
    },
  })
  const webhookAPI = new InstanceElement('test-api auth', webhookType, {
    name: 'test',
    description: 'desc',
    status: 'active',
    subscriptions: ['conditional_ticket_events'],
    endpoint: 'https://www.example.com/token',
    http_method: 'GET',
    request_format: 'json',
    authentication: {
      type: 'api_key',
      data: {
        name: 'TEST',
      },
      add_position: 'header',
    },
  })

  const brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
    brand_url: 'https://www.example.com',
    subdomain: 'otherSubdomain',
  })
  const webhookAfterFetch = new InstanceElement('webhook1', webhookType, {
    endpoint: new TemplateExpression({
      parts: [new ReferenceExpression(brand.elemID.createNestedID('brand_url'), brand.value.brand_url), '/token'],
    }),
  })
  const webhookOther = new InstanceElement('webhook2', webhookType, {
    endpoint: 'https://www.not-example.com/token',
  })
  const webhookUndefined = new InstanceElement('webhook3', webhookType, {})

  beforeAll(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('onFetch', () => {
    it('should turn endpoint to template expression with reference to brand subdomain', async () => {
      const elements = [webhook, webhook4, brand]
      await filter.onFetch(elements)
      // url is not equal to the subdomain
      expect(webhook.value.endpoint).toEqual('https://www.example.com/token')
      expect(webhook4.value.endpoint).toEqual(
        new TemplateExpression({
          parts: [
            'https://',
            new ReferenceExpression(brand.elemID.createNestedID('subdomain'), brand.value.subdomain),
            '.com/token',
          ],
        }),
      )
    })
  })
  describe('preDeploy', () => {
    it('should turn zendesk emails from template expression to string', async () => {
      const elements = [webhookAfterFetch, webhookOther, webhookUndefined, webhook4].map(e => e.clone())
      await filter.preDeploy(elements.map(elem => toChange({ after: elem })))
      const zendeskWebhook = elements.find(e => e.elemID.name === 'webhook1')
      const zendeskSubdomainWebhook = elements.find(e => e.elemID.name === 'webhook4')
      const otherWebhook = elements.find(e => e.elemID.name === 'webhook2')
      const undefinedWebhook = elements.find(e => e.elemID.name === 'webhook3')
      expect(zendeskWebhook?.value.endpoint).toEqual('https://www.example.com/token')
      expect(zendeskSubdomainWebhook?.value.endpoint).toEqual('https://otherSubdomain.com/token')
      expect(otherWebhook).toEqual(webhookOther)
      expect(undefinedWebhook).toEqual(webhookUndefined)
    })
  })
  describe('onDeploy', () => {
    let elementsAfterFetch: (InstanceElement | ObjectType)[]
    let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      const elementsBeforeFetch = [webhook, webhookOther, webhookUndefined, brand, webhook4]
      elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
      await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to after fetch state (with templates) after onDeploy', () => {
      expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
    })
    it('should not turn to template expression if it was not a template expression before', async () => {
      const webhookInstance = new InstanceElement('address1', webhookType, {
        endpoint: 'https://www.example.com',
      })
      const cloned = webhookInstance.clone()
      await filter.preDeploy([toChange({ before: webhookInstance, after: webhookInstance })])
      await filter.onDeploy([toChange({ before: webhookInstance, after: webhookInstance })])
      expect(webhookInstance).toEqual(cloned)
    })
  })
  describe('deploy', () => {
    it('should pass the correct params to deployChange on create - basic_auth', async () => {
      const id = 2
      const clonedWebhook = webhook.clone()
      const deployedWebhook = webhook.clone()
      deployedWebhook.value.authentication.data =
        AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[deployedWebhook.value.authentication.type]
      deployedWebhook.value.id = id
      mockDeployChange.mockImplementation(async () => ({ webhook: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedWebhook } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedWebhook } }])
    })
    it('should pass the correct params to deployChange on create - api auth', async () => {
      const id = 2
      const clonedWebhook = webhookAPI.clone()
      const deployedWebhook = webhookAPI.clone()
      deployedWebhook.value.authentication.data =
        AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[deployedWebhook.value.authentication.type]
      deployedWebhook.value.id = id
      mockDeployChange.mockImplementation(async () => ({ webhook: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedWebhook } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedWebhook } }])
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
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedWebhook } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedWebhook } }])
    })
    it('should pass the correct params to deployChange on create - with custom_headers', async () => {
      const id = 2
      const clonedWebhook = webhook.clone()
      clonedWebhook.value.custom_headers = {
        h1: 'v1',
      }
      const deployedWebhook = clonedWebhook.clone()
      deployedWebhook.value.authentication.data =
        AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[deployedWebhook.value.authentication.type]
      deployedWebhook.value.id = id
      mockDeployChange.mockImplementation(async () => ({ webhook: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedWebhook } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedWebhook } }])
    })

    it('should pass the correct params to deployChange on update - changed auth', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.authentication.type = 'bearer_token'
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      deployedWebhookAfter.value.authentication.data =
        AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[deployedWebhookAfter.value.authentication.type]
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
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
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
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
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedWebhookBefore, after: deployedWebhookAfter },
        },
      ])
    })
    it('should pass the correct params to deployChange on update - custom headers were changed', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      clonedWebhookBefore.value.custom_headers = {
        h1: 'v1',
        h2: 'v2',
        h4: 'v4',
      }
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.custom_headers = {
        h2: 'v2_changed',
        h3: 'v3',
        h4: 'v4',
      }
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      delete deployedWebhookAfter.value.authentication
      deployedWebhookAfter.value.custom_headers = {
        h1: null,
        h2: 'v2_changed',
        h3: 'v3',
        h4: 'v4',
      }
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedWebhookBefore, after: clonedWebhookAfter },
        },
      ])
    })
    it('should pass the correct params to deployChange on update - custom headers no changes', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      clonedWebhookBefore.value.custom_headers = {
        h1: 'v1',
        h2: 'v2',
        h4: 'v3',
      }
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.custom_headers = {
        h1: 'v1',
        h2: 'v2',
        h4: 'v3',
      }
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      delete deployedWebhookAfter.value.authentication
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedWebhookBefore, after: clonedWebhookAfter },
        },
      ])
    })
    it('should pass the correct params to deployChange on update - delete all custom headers', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      clonedWebhookBefore.value.custom_headers = {
        h2: 'v1',
        h3: 'v2',
        h4: 'v3',
      }
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.custom_headers = {}
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      delete deployedWebhookAfter.value.authentication
      deployedWebhookAfter.value.custom_headers = {
        h2: null,
        h3: null,
        h4: null,
      }
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedWebhookBefore, after: clonedWebhookAfter },
        },
      ])
    })
    it('should pass the correct params to deployChange on update - delete custom headers field', async () => {
      const id = 2
      const clonedWebhookBefore = webhook.clone()
      clonedWebhookBefore.value.custom_headers = {
        h2: 'v1',
        h3: 'v2',
        h4: 'v3',
      }
      const clonedWebhookAfter = webhook.clone()
      clonedWebhookBefore.value.id = id
      clonedWebhookAfter.value.id = id
      clonedWebhookAfter.value.custom_headers = null
      const deployedWebhookAfter = clonedWebhookAfter.clone()
      delete deployedWebhookAfter.value.authentication
      deployedWebhookAfter.value.custom_headers = {
        h2: null,
        h3: null,
        h4: null,
      }
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedWebhookBefore, after: clonedWebhookAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWebhookBefore, after: deployedWebhookAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedWebhookBefore, after: clonedWebhookAfter },
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
      deployedWebhook.value.authentication.data =
        AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[deployedWebhook.value.authentication.type]
      const res = await filter.deploy([{ action: 'add', data: { after: clonedWebhook } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedWebhook } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['external_source'],
      })
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
