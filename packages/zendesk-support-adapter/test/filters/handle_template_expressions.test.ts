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

  const automationType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'automation'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const dynamicContentType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item'),
  })

  const dynamicContentItemType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item__variants'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const dynamicContentRecord = new InstanceElement('dynamic_content_test', dynamicContentType, {
    placeholder: '{{dc.dynamic_content_test}}',
  })

  const webhookType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'webhook'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const appInstallationType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'app_installation'),
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
  const macroWithDC = new InstanceElement('macroDynamicContent', testType, { id: 1033, actions: [{ value: 'dynamic content ref {{dc.dynamic_content_test}} and {{ticket.ticket_field_option_title_1453}}', field: 'comment_value_html' }] })

  const macroAlmostTemplate = new InstanceElement('macroAlmost', testType, { id: 1001, actions: [{ value: 'almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1454}}', field: 'comment_value_html' }] })
  const macroAlmostTemplate2 = new InstanceElement('macroAlmost2', testType, { id: 1001, actions: [{ value: '{{ticket.ticket_field_1452}}', field: 'not_template_field' }] })
  const target = new InstanceElement('target', targetType, { id: 1004, target_url: 'url: {{ticket.ticket_field_1452}}' })
  const trigger = new InstanceElement('trigger', triggerType, { id: 1005, actions: [{ value: 'ticket: {{ticket.ticket_field_1452}}', field: 'notification_webhook' }] })
  const webhook = new InstanceElement('webhook', webhookType, { id: 1006, endpoint: 'endpoint: {{ticket.ticket_field_1452}}' })
  const automation = new InstanceElement('automation', automationType, { id: 1007, actions: [{ value: 'ticket: {{ticket.ticket_field_1452}}', field: 'notification_webhook' }] })
  const dynamicContent = new InstanceElement('dc', dynamicContentItemType, { id: 1008, content: 'content: {{ticket.ticket_field_1452}}' })
  const appInstallation = new InstanceElement('appInstallation', appInstallationType, {
    id: 1009,
    settings: { uri_templates: 'template: {{ticket.ticket_field_1452}}' },
    settings_objects: [{ name: 'uri_templates', value: 'object template: {{ticket.ticket_field_1452}}' }],
  })


  const generateElements = (): (InstanceElement | ObjectType)[] => ([testType, placeholder1Type,
    placeholder2Type, placeholder1, placeholder2, macro1, macro2, macro3, macroAlmostTemplate,
    macroAlmostTemplate2, target, trigger, webhook, targetType, triggerType, webhookType,
    automation, automationType, dynamicContent, dynamicContentItemType, appInstallation,
    appInstallationType, macroWithDC, dynamicContentRecord])
    .map(element => element.clone())

  describe('on fetch', () => {
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
      const fetchedMacroAlmostTemplate = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroAlmost')
      expect(fetchedMacroAlmostTemplate?.value.actions[0].value).toEqual('almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1454}}')
      const fetchedMacroAlmostTemplate2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroAlmost2')
      expect(fetchedMacroAlmostTemplate2?.value.actions[0].value).toEqual('{{ticket.ticket_field_1452}}')
    })

    it('should resolve one template correctly, in any type', () => {
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
      const fetchedAutomation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'automation')
      expect(fetchedAutomation?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        'ticket: {{',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedDynamicContent = elements.filter(isInstanceElement).find(i => i.elemID.name === 'dc')
      expect(fetchedDynamicContent?.value.content).toEqual(new TemplateExpression({ parts: [
        'content: {{',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedAppInstallation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'appInstallation')
      expect(fetchedAppInstallation?.value.settings.uri_templates).toEqual(
        new TemplateExpression({ parts: [
          'template: {{',
          new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] })
      )
      expect(fetchedAppInstallation?.value.settings_objects[0].value).toEqual(
        new TemplateExpression({ parts: [
          'object template: {{',
          new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] })
      )
      const fetchedDCMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroDynamicContent')
      expect(fetchedDCMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({ parts: [
          'dynamic content ref {{',
          new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
          '}} and {{',
          new ReferenceExpression(placeholder2.elemID, placeholder2),
          '}}'] })
      )
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
