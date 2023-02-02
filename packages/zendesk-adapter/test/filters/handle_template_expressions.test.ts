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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression,
  BuiltinTypes, TemplateExpression, MapType, toChange, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator, {
  TICKET_ORGANIZATION_FIELD,
  TICKET_TICKET_FIELD_OPTION_TITLE,
  TICKET_TICKET_FIELD, TICKET_USER_FIELD,
} from '../../src/filters/handle_template_expressions'
import { ORG_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createMissingInstance } from '../../src/filters/references/missing_references'
import { createFilterCreatorParams } from '../utils'

describe('handle templates filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType

  beforeAll(() => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  const testType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'macro'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'trigger'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const targetType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'target'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const automationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'automation'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const dynamicContentType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'dynamic_content_item'),
  })

  const dynamicContentItemType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'dynamic_content_item__variants'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const dynamicContentRecord = new InstanceElement('dynamic_content_test', dynamicContentType, {
    placeholder: '{{dc.dynamic_content_test}}',
  })

  const hyphenDynamicContentRecord = new InstanceElement('dynamic-content-test', dynamicContentType, {
    placeholder: '{{dc.dynamic-content-test}}',
  })

  const webhookType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'webhook'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const appInstallationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'app_installation'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const placeholder1Type = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field'),
  })

  const placeholder2Type = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
  })

  const placeholder3Type = new ObjectType({
    elemID: new ElemID(ZENDESK, ORG_FIELD_TYPE_NAME),
  })

  const placeholder4Type = new ObjectType({
    elemID: new ElemID(ZENDESK, USER_FIELD_TYPE_NAME),
  })

  const placeholder1 = new InstanceElement('placeholder1', placeholder1Type, { id: 1452 })
  const placeholder2 = new InstanceElement('placeholder2', placeholder1Type, { id: 1453 })
  const placeholder3 = new InstanceElement('placeholder3', placeholder1Type, { id: 1454 })
  const placeholderOrganization1 = new InstanceElement('placeholder-org1', placeholder3Type, { key: 'org' })
  const placeholderOrganization2 = new InstanceElement('placeholder-org2', placeholder3Type, { key: 'org_123' })
  const placeholderUser1 = new InstanceElement('placeholder-user1', placeholder4Type, { key: 'user' })
  const placeholderUser2 = new InstanceElement('placeholder-user2', placeholder4Type, { key: 'user_123' })

  const macro1 = new InstanceElement('macro1', testType, { id: 1001, actions: [{ value: 'non template', field: 'comment_value_html' }] })
  const macro2 = new InstanceElement('macro2', testType, { id: 1002, actions: [{ value: '{{ticket.ticket_field_1452}}', field: 'comment_value' }] })
  const macro3 = new InstanceElement('macro3', testType, { id: 1003, actions: [{ value: 'multiple refs {{ticket.ticket_field_1452}} and {{ticket.ticket_field_option_title_1453}}', field: 'comment_value_html' }] })
  const macroOrganization = new InstanceElement('macroOrg', testType, { id: 1004, actions: [{ value: 'multiple refs {{ticket.organization.custom_fields.org_123}} and {{ticket.organization.custom_fields.org}} and {{ticket.organization.custom_fields.org_123.title}}', field: 'comment_value_html' }] })
  const macroUser = new InstanceElement('macroUser', testType, { id: 1005, actions: [{ value: 'multiple refs {{ticket.requester.custom_fields.user_123}} and {{ticket.requester.custom_fields.user}} and {{ticket.requester.custom_fields.user_123.title}}', field: 'comment_value_html' }] })
  const macroMissingUserAndOrganization = new InstanceElement('macroMissingOrgAndUser', testType, { id: 1005, actions: [{ value: 'multiple refs {{ticket.requester.custom_fields.user1}} and {{ticket.requester.custom_fields.user1.title}} and {{ticket.organization.custom_fields.org1}} and {{ticket.organization.custom_fields.org1.title}}', field: 'comment_value_html' }] })

  const macroComplicated = new InstanceElement('macroComplicated', testType, { id: 1003, actions: [{ value: '{{some other irrelevancies-ticket.ticket_field_1452 | something irrelevant | dynamic content now: dc.dynamic_content_test | and done}}', field: 'comment_value_html' }] })
  const macroDifferentBracket = new InstanceElement('macroDifferentBracket', testType, { id: 1010, actions: [{ value: '{%some other irrelevancies-ticket.ticket_field_1452 | something irrelevant | dynamic content now: dc.dynamic_content_test | and done%}', field: 'comment_value_html' }] })
  const macroWithSideConversationTicketTemplate = new InstanceElement(
    'macroSideConvTicket',
    testType,
    {
      id: 1020,
      actions: [
        {
          value:
            [
              'Improved needs for {{ticket.ticket_field_option_title_1454}}',
              '<p>Improved needs for {{ticket.ticket_field_option_title_1454}} due to something</p>',
              'hello',
              'text/html',
            ],
          field: 'side_conversation_ticket',
        },
        {
          value:
            [
              'Improved needs for {{ticket.ticket_field_option_title_1454}}',
              '<p>Improved needs for {{ticket.ticket_field_option_title_1454}} due to something</p>',
              'hello',
              'text/html',
            ],
          field: 'side_conversation_slack',
        },
        {
          value:
            [
              'Improved needs for {{ticket.ticket_field_1452}}',
              '<p>Improved needs for {{ticket.ticket_field_1452}} due to something</p>',
              'hello',
              'text/html',
            ],
          field: 'side_conversation',
        },
        {
          value: 'Improved needs for {{ticket.ticket_field_1452}} - {{ticket.ticket_field_1452}}',
          field: 'subject',
        },
      ],
    },
  )

  const macroWithDC = new InstanceElement('macroDynamicContent', testType, { id: 1033, actions: [{ value: 'dynamic content ref {{dc.dynamic_content_test}} and {{ticket.ticket_field_option_title_1453}}', field: 'comment_value_html' }] })
  const macroWithHyphenDC = new InstanceElement('macroHyphenDynamicContent', testType, { id: 1034, actions: [{ value: 'dynamic content ref {{dc.dynamic-content-test}} and {{ticket.ticket_field_option_title_1453}}', field: 'comment_value_html' }] })

  const macroAlmostTemplate = new InstanceElement('macroAlmost', testType, { id: 1001, actions: [{ value: 'almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1455}}', field: 'comment_value_html' }] })
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
    appInstallationType, macroWithDC, macroWithHyphenDC, dynamicContentRecord,
    hyphenDynamicContentRecord, macroComplicated, macroDifferentBracket,
    macroWithSideConversationTicketTemplate, placeholder3, placeholderOrganization1, placeholderOrganization2,
    placeholderUser1, placeholderUser2, macroOrganization, macroUser, macroMissingUserAndOrganization])
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
      const missingInstance = createMissingInstance(ZENDESK, 'ticket_field', '1455')
      missingInstance.value.id = '1455'
      expect(fetchedMacroAlmostTemplate?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          `almost template {{ticket.not_an_actual_field_1452}} and {{${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(missingInstance.elemID, missingInstance),
          '}}',
        ],
      }))
      const fetchedMacroAlmostTemplate2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroAlmost2')
      expect(fetchedMacroAlmostTemplate2?.value.actions[0].value).toEqual('{{ticket.ticket_field_1452}}')
    })

    it('should resolve one template correctly, in any type', () => {
      const fetchedMacro2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro2')
      expect(fetchedMacro2?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        `{{${TICKET_TICKET_FIELD}_`,
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedTarget = elements.filter(isInstanceElement).find(i => i.elemID.name === 'target')
      expect(fetchedTarget?.value.target_url).toEqual(new TemplateExpression({ parts: [
        `url: {{${TICKET_TICKET_FIELD}_`,
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedWebhook = elements.filter(isInstanceElement).find(i => i.elemID.name === 'webhook')
      expect(fetchedWebhook?.value.endpoint).toEqual(new TemplateExpression({ parts: [
        `endpoint: {{${TICKET_TICKET_FIELD}_`,
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedTrigger = elements.filter(isInstanceElement).find(i => i.elemID.name === 'trigger')
      expect(fetchedTrigger?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        `ticket: {{${TICKET_TICKET_FIELD}_`,
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedAutomation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'automation')
      expect(fetchedAutomation?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        `ticket: {{${TICKET_TICKET_FIELD}_`,
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedDynamicContent = elements.filter(isInstanceElement).find(i => i.elemID.name === 'dc')
      expect(fetchedDynamicContent?.value.content).toEqual(new TemplateExpression({ parts: [
        `content: {{${TICKET_TICKET_FIELD}_`,
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
      const fetchedAppInstallation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'appInstallation')
      expect(fetchedAppInstallation?.value.settings.uri_templates).toEqual(
        new TemplateExpression({ parts: [
          `template: {{${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] })
      )
      expect(fetchedAppInstallation?.value.settings_objects[0].value).toEqual(
        new TemplateExpression({ parts: [
          `object template: {{${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] })
      )
      const fetchedDCMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroDynamicContent')
      expect(fetchedDCMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({ parts: [
          'dynamic content ref {{',
          new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
          `}} and {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
          new ReferenceExpression(placeholder2.elemID, placeholder2),
          '}}'] })
      )

      const fetchedHyphenDCMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroHyphenDynamicContent')
      expect(fetchedHyphenDCMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({ parts: [
          'dynamic content ref {{',
          new ReferenceExpression(hyphenDynamicContentRecord.elemID, hyphenDynamicContentRecord),
          `}} and {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
          new ReferenceExpression(placeholder2.elemID, placeholder2),
          '}}'] })
      )
    })

    it('should resolve more complicated templates correctly', () => {
      const fetchedMacroComplicated = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroComplicated')
      expect(fetchedMacroComplicated?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [`{{some other irrelevancies-${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          ' | something irrelevant | dynamic content now: ',
          new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
          ' | and done}}'],
      }))
      const fetchedMacroDifferentBracket = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroDifferentBracket')
      expect(fetchedMacroDifferentBracket?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [`{%some other irrelevancies-${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          ' | something irrelevant | dynamic content now: ',
          new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
          ' | and done%}'],
      }))
    })

    it('should resolve multiple templates correctly', () => {
      const fetchedMacro3 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro3')
      expect(fetchedMacro3?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          `multiple refs {{${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          `}} and {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
          new ReferenceExpression(placeholder2.elemID, placeholder2),
          '}}',
        ],
      }))
    })

    it('should resolve side_conversation_ticket correctly', () => {
      const macroWithSideConv = elements
        .filter(isInstanceElement)
        .filter(i => i.elemID.name === 'macroSideConvTicket')[0]
      expect(macroWithSideConv).toBeDefined()
      expect(macroWithSideConv.value.actions[0].value).toEqual([
        new TemplateExpression({ parts: [`Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`, new ReferenceExpression(placeholder3.elemID, placeholder3), '}}'] }),
        new TemplateExpression({ parts: [`<p>Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`, new ReferenceExpression(placeholder3.elemID, placeholder3), '}} due to something</p>'] }),
        'hello',
        'text/html',
      ])
      expect(macroWithSideConv.value.actions[1].value).toEqual([
        new TemplateExpression({ parts: [`Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`, new ReferenceExpression(placeholder3.elemID, placeholder3), '}}'] }),
        new TemplateExpression({ parts: [`<p>Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`, new ReferenceExpression(placeholder3.elemID, placeholder3), '}} due to something</p>'] }),
        'hello',
        'text/html',
      ])
      expect(macroWithSideConv.value.actions[2].value).toEqual([
        new TemplateExpression({ parts: [`Improved needs for {{${TICKET_TICKET_FIELD}_`, new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }),
        new TemplateExpression({ parts: [`<p>Improved needs for {{${TICKET_TICKET_FIELD}_`, new ReferenceExpression(placeholder1.elemID, placeholder1), '}} due to something</p>'] }),
        'hello',
        'text/html',
      ])
      expect(macroWithSideConv.value.actions[3].value).toEqual(
        new TemplateExpression({ parts: [
          `Improved needs for {{${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          `}} - {{${TICKET_TICKET_FIELD}_`,
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          '}}',
        ] }),
      )
    })
    it('should resolve organization correctly', () => {
      const fetchedMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroOrg')
      expect(fetchedMacro?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          `multiple refs {{${TICKET_ORGANIZATION_FIELD}.`,
          new ReferenceExpression(placeholderOrganization2.elemID, placeholderOrganization2),
          `}} and {{${TICKET_ORGANIZATION_FIELD}.`,
          new ReferenceExpression(placeholderOrganization1.elemID, placeholderOrganization1),
          `}} and {{${TICKET_ORGANIZATION_FIELD}.`,
          new ReferenceExpression(placeholderOrganization2.elemID, placeholderOrganization2),
          '.title}}',
        ],
      }))
    })
    it('should resolve requester correctly', () => {
      const fetchedMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroUser')
      expect(fetchedMacro?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          `multiple refs {{${TICKET_USER_FIELD}.`,
          new ReferenceExpression(placeholderUser2.elemID, placeholderUser2),
          `}} and {{${TICKET_USER_FIELD}.`,
          new ReferenceExpression(placeholderUser1.elemID, placeholderUser1),
          `}} and {{${TICKET_USER_FIELD}.`,
          new ReferenceExpression(placeholderUser2.elemID, placeholderUser2),
          '.title}}',
        ],
      }))
    })
    it('should resolve as missing for organization and requester', () => {
      const fetchedMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroMissingOrgAndUser')
      const missingOrgInstance = createMissingInstance(ZENDESK, ORG_FIELD_TYPE_NAME, 'org1')
      const missingUserInstance = createMissingInstance(ZENDESK, USER_FIELD_TYPE_NAME, 'user1')
      missingOrgInstance.value.key = 'org1'
      missingUserInstance.value.key = 'user1'
      expect(fetchedMacro?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          `multiple refs {{${TICKET_USER_FIELD}.`,
          new ReferenceExpression(missingUserInstance.elemID, missingUserInstance),
          `}} and {{${TICKET_USER_FIELD}.`,
          new ReferenceExpression(missingUserInstance.elemID, missingUserInstance),
          `.title}} and {{${TICKET_ORGANIZATION_FIELD}.`,
          new ReferenceExpression(missingOrgInstance.elemID, missingOrgInstance),
          `}} and {{${TICKET_ORGANIZATION_FIELD}.`,
          new ReferenceExpression(missingOrgInstance.elemID, missingOrgInstance),
          '.title}}',
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
