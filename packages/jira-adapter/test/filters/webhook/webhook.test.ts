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
import { Element, InstanceElement, CORE_ANNOTATIONS, ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { mockClient } from '../../utils'
import webhookFilter from '../../../src/filters/webhook/webhook'
import { DEFAULT_CONFIG, JiraConfig } from '../../../src/config'
import JiraClient, { PRIVATE_API_HEADERS } from '../../../src/client/client'
import { createWebhookTypes } from '../../../src/filters/webhook/types'
import { JIRA, WEBHOOK_TYPE } from '../../../src/constants'


describe('webhookFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>


  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(DEFAULT_CONFIG)
    filter = webhookFilter({
      client,
      paginator,
      config,
      elementsSource: buildElementsSourceFromElements([]),
    }) as filterUtils.FilterWith<'onFetch' | 'deploy'>

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
      ],
    })
  })

  describe('onFetch', () => {
    it('should fetch webhooks from the service', async () => {
      const elements: Element[] = []
      await filter.onFetch(elements)

      const webhookTypes = createWebhookTypes()
      expect(elements).toHaveLength(
        1 // new webhook instance
        + 1 // webhook top level type
        + webhookTypes.subTypes.length
      )

      const webhook = elements[0] as InstanceElement

      expect(webhook.elemID.getFullName()).toEqual('jira.Webhook.instance.someName')

      expect(webhook.value).toEqual({
        id: '3',
        name: 'someName',
      })

      expect(webhook.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBe('someUser')

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/webhooks/1.0/webhook',
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should use elemIdGetter', async () => {
      const { paginator } = mockClient()
      filter = webhookFilter({
        client,
        paginator,
        config,
        elementsSource: buildElementsSourceFromElements([]),
        getElemIdFunc: () => new ElemID(JIRA, 'someName2'),
      }) as filterUtils.FilterWith<'onFetch' | 'deploy'>
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

  describe('deploy', () => {
    let type: ObjectType
    let instance: InstanceElement

    beforeEach(() => {
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
        }
      )
    })
  })
})
