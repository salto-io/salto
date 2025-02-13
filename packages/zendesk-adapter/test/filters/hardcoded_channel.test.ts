/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, isObjectType, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator, { TRIGGER_DEFINITION_TYPE_NAME, CHANNEL_TYPE_NAME } from '../../src/filters/hardcoded_channel'
import { createFilterCreatorParams } from '../utils'

describe('hardcoded channel filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const channelObjType = new ObjectType({ elemID: new ElemID(ZENDESK, CHANNEL_TYPE_NAME) })
  const triggerDefinitionObjType = new ObjectType({
    elemID: new ElemID(ZENDESK, TRIGGER_DEFINITION_TYPE_NAME),
  })
  const triggerDefinitionInstance = new InstanceElement(ElemID.CONFIG_NAME, triggerDefinitionObjType, {
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
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should add the correct type and instances', async () => {
      const elements = [triggerDefinitionObjType, triggerDefinitionInstance, channelObjType].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.channel',
        'zendesk.channel.instance.Chat',
        'zendesk.channel.instance.Email',
        'zendesk.channel.instance.Twitter',
        'zendesk.channel.instance.Web_form@s',
        'zendesk.trigger_definition',
        'zendesk.trigger_definition.instance',
      ])
      const webFormChannel = elements
        .filter(isInstanceElement)
        .find(e => e.elemID.getFullName() === 'zendesk.channel.instance.Web_form@s')
      expect(webFormChannel).toBeDefined()
      expect(webFormChannel?.value?.name).toEqual('Web form')
    })
    it('should add nothing if there is no trigger definition instance', async () => {
      const elements = [channelObjType.clone(), triggerDefinitionObjType.clone()]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.channel',
        'zendesk.trigger_definition',
      ])
      const channelType = elements.filter(isObjectType).find(e => e.elemID.typeName === CHANNEL_TYPE_NAME)
      expect(channelType).toBeDefined()
      expect(Object.keys(channelType?.fields ?? {}).sort()).toEqual([])
    })
    it('should add nothing if there is no channels in the trigger definition instance', async () => {
      const emptyTriggerDefinitionsInstance = new InstanceElement(ElemID.CONFIG_NAME, triggerDefinitionObjType)
      const elements = [triggerDefinitionObjType.clone(), channelObjType.clone(), emptyTriggerDefinitionsInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.channel',
        'zendesk.trigger_definition',
        'zendesk.trigger_definition.instance',
      ])
    })
    it('should not add the type and instances if the trigger_definition channels are invalid', async () => {
      const invalidTriggerDefinitionInstance = new InstanceElement(ElemID.CONFIG_NAME, triggerDefinitionObjType, {
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
      })
      const elements = [triggerDefinitionObjType.clone(), channelObjType.clone(), invalidTriggerDefinitionInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.channel',
        'zendesk.trigger_definition',
        'zendesk.trigger_definition.instance',
      ])
    })
    it('should not add the type and instances if the channels are not unique', async () => {
      const invalidTriggerDefinitionInstance = new InstanceElement(ElemID.CONFIG_NAME, triggerDefinitionObjType, {
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
      })
      const elements = [triggerDefinitionObjType.clone(), channelObjType.clone(), invalidTriggerDefinitionInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.channel',
        'zendesk.trigger_definition',
        'zendesk.trigger_definition.instance',
      ])
    })
    it('should not add the type and instances if there is no channel condition', async () => {
      const invalidTriggerDefinitionInstance = new InstanceElement(ElemID.CONFIG_NAME, triggerDefinitionObjType, {
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
      })
      const elements = [triggerDefinitionObjType.clone(), channelObjType.clone(), invalidTriggerDefinitionInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.channel',
        'zendesk.trigger_definition',
        'zendesk.trigger_definition.instance',
      ])
    })
    it('should not add anything if the channel type is missing', async () => {
      const elements = [triggerDefinitionObjType.clone(), triggerDefinitionInstance]
      const res = await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.trigger_definition',
        'zendesk.trigger_definition.instance',
      ])
      expect(res).toBeUndefined()
    })
  })
})
