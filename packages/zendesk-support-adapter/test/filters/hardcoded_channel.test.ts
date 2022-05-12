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
import { ObjectType, ElemID, InstanceElement, isObjectType } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator, { TRIGGER_DEFINITION_TYPE_NAME, CHANNEL_TYPE_NAME } from '../../src/filters/hardcoded_channel'

describe('hardcoded channel filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const channelObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, CHANNEL_TYPE_NAME) })
  const triggerDefinitionObjType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, TRIGGER_DEFINITION_TYPE_NAME),
  })
  const triggerDefinitionInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    triggerDefinitionObjType,
    {
      conditions_all: [
        {
          title: 'Channel',
          subject: 'via_id',
          operators: [
            { value: 'is', title: 'Is', terminal: false },
            { value: 'is_not', title: 'Is not', terminal: false },
          ],
          values: [
            { value: '0', title: 'Web form', enabled: true },
            { value: '4', title: 'Email', enabled: true },
            { value: '29', title: 'Chat', enabled: true },
            { value: '30', title: 'Twitter', enabled: true },
          ],
        },
      ],
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

  describe('onFetch', () => {
    it('should add the correct type and instances', async () => {
      const elements = [
        triggerDefinitionObjType.clone(),
        triggerDefinitionInstance.clone(),
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.channel',
          'zendesk_support.channel.instance.Chat',
          'zendesk_support.channel.instance.Email',
          'zendesk_support.channel.instance.Twitter',
          'zendesk_support.channel.instance.Web_form@s',
          'zendesk_support.trigger_definition',
          'zendesk_support.trigger_definition.instance',
        ])
      const channelType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === CHANNEL_TYPE_NAME)
      expect(channelType).toBeDefined()
      expect(Object.keys(channelType?.fields ?? {}).sort()).toEqual(['id', 'name'])
    })
    it('should add nothing if there is no trigger definition instance', async () => {
      const elements = [
        channelObjType.clone(),
        triggerDefinitionObjType.clone(),
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.channel',
          'zendesk_support.trigger_definition',
        ])
      const channelType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === CHANNEL_TYPE_NAME)
      expect(channelType).toBeDefined()
      expect(Object.keys(channelType?.fields ?? {}).sort()).toEqual([])
    })
    it('should add nothing if there is no channels in the trigger definition instance', async () => {
      const emptyTriggerDefinitionsInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        triggerDefinitionObjType,
      )
      const elements = [
        triggerDefinitionObjType.clone(),
        emptyTriggerDefinitionsInstance,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.trigger_definition',
          'zendesk_support.trigger_definition.instance',
        ])
    })
    it('should not add the type and instances if the trigger_definition channels are invalid', async () => {
      const invalidTriggerDefinitionInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        triggerDefinitionObjType,
        {
          conditions_all: [
            {
              title: 'Channel',
              subject: 'via_id',
              values: [
                { value: '0', enabled: true },
                { value: '4', title: 'Email', enabled: true },
                { value: '29', title: 'Chat', enabled: true },
                { value: '30', title: 'Twitter', enabled: true },
              ],
            },
          ],
        },
      )
      const elements = [
        triggerDefinitionObjType.clone(),
        invalidTriggerDefinitionInstance,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.trigger_definition',
          'zendesk_support.trigger_definition.instance',
        ])
    })
    it('should not add the type and instances if the channels are not unique', async () => {
      const invalidTriggerDefinitionInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        triggerDefinitionObjType,
        {
          conditions_all: [
            {
              title: 'Channel',
              subject: 'via_id',
              values: [
                { value: '4', title: 'Email', enabled: true },
                { value: '4', title: 'Test', enabled: true },
                { value: '29', title: 'Chat', enabled: true },
                { value: '30', title: 'Twitter', enabled: true },
              ],
            },
          ],
        },
      )
      const elements = [
        triggerDefinitionObjType.clone(),
        invalidTriggerDefinitionInstance,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.trigger_definition',
          'zendesk_support.trigger_definition.instance',
        ])
    })
    it('should not add the type and instances if there is no channel condition', async () => {
      const invalidTriggerDefinitionInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        triggerDefinitionObjType,
        {
          conditions_all: [
            {
              title: 'Test',
              subject: 'another_test',
              values: [
                { value: '4', title: 'Email', enabled: true },
                { value: '4', title: 'Test', enabled: true },
              ],
            },
          ],
        },
      )
      const elements = [
        triggerDefinitionObjType.clone(),
        invalidTriggerDefinitionInstance,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.trigger_definition',
          'zendesk_support.trigger_definition.instance',
        ])
    })
  })
})
