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
import { Element, InstanceElement, CORE_ANNOTATIONS, ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import webhookFilter from '../../../src/filters/webhook/webhook'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import JiraClient from '../../../src/client/client'
import { createWebhookTypes } from '../../../src/filters/webhook/types'
import { JIRA, WEBHOOK_TYPE } from '../../../src/constants'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'


describe('webhookFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let type: ObjectType
  let instance: InstanceElement
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    type = new ObjectType({
      elemID: new ElemID(JIRA, WEBHOOK_TYPE),
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        name: 'someName',
      }
    )

    fetchQuery = elementUtils.query.createMockQuery()

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = webhookFilter(getFilterParams({
      client,
      paginator,
      config,
      fetchQuery,
    })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

    connection.get.mockResolvedValue({
      status: 200,
      data: [
        {
          name: 'someName',
          self: 'https://someUrl/rest/webhooks/1.0/webhook/3',
          lastUpdatedUser: 'ug:193ee60b-5f81-454f-a6c6-0a64e6f68294',
          lastUpdatedDisplayName: 'someUser',
          lastUpdated: 1649521874248,
        },
        {
          name: 'someName2',
          filters: {
            'issue-related-events-section': 'someFilter',
          },
          self: 'https://someUrl/rest/webhooks/1.0/webhook/3',
          lastUpdatedUser: 'ug:193ee60b-5f81-454f-a6c6-0a64e6f68294',
          lastUpdatedDisplayName: 'someUser',
          lastUpdated: 1649521874248,
        },
      ],
    })
  })

  describe('onFetch', () => {
    it('should fetch webhooks from the service', async () => {
      const elements: Element[] = []
      await filter.onFetch(elements)

      const webhookTypes = createWebhookTypes()
      expect(elements).toHaveLength(
        2 // new webhook instances
        + 1 // webhook top level type
        + webhookTypes.subTypes.length
      )

      const [webhook1, webhook2] = elements as InstanceElement[]

      expect(webhook1.elemID.getFullName()).toEqual('jira.Webhook.instance.someName')

      expect(webhook1.value).toEqual({
        id: '3',
        name: 'someName',
        filters: {},
      })

      expect(webhook1.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBe('someUser')

      expect(webhook2.elemID.getFullName()).toEqual('jira.Webhook.instance.someName2')

      expect(webhook2.value).toEqual({
        id: '3',
        name: 'someName2',
        filters: {
          issue_related_events_section: 'someFilter',
        },
      })

      expect(webhook2.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBe('someUser')

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/webhooks/1.0/webhook',
        {
          headers: PRIVATE_API_HEADERS,
        },

      )
    })

    it('should not fetch webhooks if webhooks were excluded', async () => {
      fetchQuery.isTypeMatch.mockReturnValue(false)

      const elements: Element[] = []
      await filter.onFetch(elements)

      expect(elements).toEqual([])
    })

    it('should use elemIdGetter', async () => {
      const { paginator } = mockClient()
      filter = webhookFilter(getFilterParams({
        client,
        paginator,
        config,
        getElemIdFunc: () => new ElemID(JIRA, 'someName2'),
        fetchQuery: elementUtils.query.createMockQuery(),
      })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
      const elements: Element[] = []
      await filter.onFetch(elements)


      const webhook = elements[0] as InstanceElement

      expect(webhook.elemID.getFullName()).toEqual('jira.Webhook.instance.someName2')
    })

    it('should throw when received invalid response', async () => {
      connection.get.mockResolvedValue({
        status: 200,
        data: [{}],
      })
      await expect(filter.onFetch([])).rejects.toThrow()
    })
  })

  describe('preDeploy', () => {
    it('should replace field name', async () => {
      instance.value.filters = {
        issue_related_events_section: 'someFilter',
      }
      const change = toChange({
        after: instance,
      })

      await filter.preDeploy([change])

      expect(instance.value.filters).toEqual({
        'issue-related-events-section': 'someFilter',
      })
    })

    it('should do nothing if filters is undefined', async () => {
      const change = toChange({
        after: instance,
      })

      await filter.preDeploy([change])

      expect(instance.value.filters).toBeUndefined()
    })
  })

  describe('onDeploy', () => {
    it('should replace field name', async () => {
      instance.value.filters = {
        'issue-related-events-section': 'someFilter',
      }
      const change = toChange({
        after: instance,
      })

      await filter.onDeploy([change])

      expect(instance.value.filters).toEqual({
        issue_related_events_section: 'someFilter',
      })
    })

    it('should do nothing if filters is undefined', async () => {
      const change = toChange({
        after: instance,
      })

      await filter.onDeploy([change])

      expect(instance.value.filters).toBeUndefined()
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      connection.post.mockResolvedValue({
        status: 201,
        data: {
          self: 'https://someUrl/rest/webhooks/1.0/webhook/3',
        },
      })
    })

    it('should create webhook', async () => {
      await filter.deploy([toChange({ after: instance })])

      expect(instance.value.id).toBe('3')

      expect(connection.post).toHaveBeenCalledWith(
        '/rest/webhooks/1.0/webhook',
        instance.value,
        undefined,
      )
    })

    it('should fail creating webhook if response is invalid', async () => {
      connection.post.mockResolvedValue({
        status: 201,
        data: {},
      })
      const { deployResult } = await filter.deploy([toChange({ after: instance })])

      expect(deployResult.errors).toHaveLength(1)
    })

    it('should delete webhook', async () => {
      instance.value.id = '3'
      await filter.deploy([toChange({ before: instance })])

      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/webhooks/1.0/webhook/3',
        undefined,
      )
    })

    it('should modify webhook', async () => {
      instance.value.id = '3'
      await filter.deploy([toChange({ before: instance, after: instance })])

      expect(connection.put).toHaveBeenCalledWith(
        '/rest/webhooks/1.0/webhook/3',
        {
          id: '3',
          name: 'someName',
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })
  })
})
