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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression,
  BuiltinTypes, TemplateExpression, MapType, toChange, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/handle_template_expressions'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../src/config'
import { ZENDESK_SUPPORT } from '../../src/constants'

describe('handle templates filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType

  beforeAll(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'c' },
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

  const testType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'macro'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'trigger'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const targetType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'target'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const webhookType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'webhook'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const placeholder1Type = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field'),
  })

  const placeholder2Type = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field__custom_field_options'),
  })

  const placeholder1 = new InstanceElement('placeholder1', placeholder1Type, { id: 1452 })
  const placeholder2 = new InstanceElement('placeholder2', placeholder2Type, { id: 1453 })
  const macro1 = new InstanceElement('macro1', testType, { id: 1001, actions: [{ value: 'non template', field: 'comment_value_html' }] })
  const macro2 = new InstanceElement('macro2', testType, { id: 1002, actions: [{ value: '{{ticket.ticket_field_1452}}', field: 'comment_value' }] })
  const macro3 = new InstanceElement('macro3', testType, { id: 1003, actions: [{ value: 'multiple refs {{ticket.ticket_field_1452}} and {{ticket.ticket_field_option_title_1453}}', field: 'comment_value_html' }] })
  const macroAlmostTemplate = new InstanceElement('macroAlmost', testType, { id: 1001, actions: [{ value: 'almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1454}}', field: 'comment_value_html' }] })

  const target = new InstanceElement('target', targetType, { id: 1004, target_url: 'url: {{ticket.ticket_field_1452}}' })
  const trigger = new InstanceElement('trigger', triggerType, { id: 1005, actions: [{ value: 'ticket: {{ticket.ticket_field_1452}}', field: 'notification_webhook' }] })
  const webhook = new InstanceElement('webhook', webhookType, { id: 1006, endpoint: 'endpoint: {{ticket.ticket_field_1452}}' })

  const generateElements = (): (InstanceElement | ObjectType)[] => ([testType, placeholder1Type,
    placeholder2Type, placeholder1, placeholder2, macro1, macro2, macro3, macroAlmostTemplate,
    target, trigger, webhook, targetType, triggerType, webhookType])
    .map(element => element.clone())

  describe('on fetch', () => {
    let fetchedMacroAlmostTemplate: InstanceElement | undefined
    let elements: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve non-template normally', () => {
      const fetchedMacro1 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro1')
      expect(fetchedMacro1?.value.actions[0].value).toEqual('non template')
    })

    it('should resolve almost-template normally', () => {
      fetchedMacroAlmostTemplate = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroAlmost')
      expect(fetchedMacroAlmostTemplate?.value.actions[0].value).toEqual('almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1454}}')
    })

    it('should resolve one template correctly', () => {
      const fetchedMacro2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro2')
      expect(fetchedMacro2?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        '{{',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedTarget = elements.filter(isInstanceElement).find(i => i.elemID.name === 'target')
      expect(fetchedTarget?.value.target_url).toEqual(new TemplateExpression({ parts: [
        'url: {{',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedWebhook = elements.filter(isInstanceElement).find(i => i.elemID.name === 'webhook')
      expect(fetchedWebhook?.value.endpoint).toEqual(new TemplateExpression({ parts: [
        'endpoint: {{',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedTrigger = elements.filter(isInstanceElement).find(i => i.elemID.name === 'trigger')
      expect(fetchedTrigger?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        'ticket: {{',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
    })

    it('should resolve multiple templates correctly', () => {
      const fetchedMacro3 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro3')
      expect(fetchedMacro3?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          'multiple refs {{',
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          '}} and {{',
          new ReferenceExpression(placeholder2.elemID, placeholder2),
          '}}',
        ],
      }))
    })
  })
  describe('preDeploy', () => {
    let elementsBeforeFetch: (InstanceElement | ObjectType)[]
    let elementsAfterPreDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      elementsBeforeFetch = generateElements()
      const elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to origin after predeploy', () => {
      expect(elementsAfterPreDeploy).toEqual(elementsBeforeFetch)
    })
  })

  describe('onDeploy', () => {
    let elementsAfterFetch: (InstanceElement | ObjectType)[]
    let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      // we recreate feth and onDeploy to have the templates in place to be restored by onDeploy
      const elementsBeforeFetch = generateElements()
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
  })
})
