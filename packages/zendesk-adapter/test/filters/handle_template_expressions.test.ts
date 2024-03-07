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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  BuiltinTypes,
  TemplateExpression,
  MapType,
  toChange,
  isInstanceElement,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { filterUtils, references as referencesUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import filterCreator, {
  TICKET_ORGANIZATION_FIELD,
  TICKET_TICKET_FIELD_OPTION_TITLE,
  TICKET_TICKET_FIELD,
  TICKET_USER_FIELD,
  prepRef,
} from '../../src/filters/handle_template_expressions'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  GROUP_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const { createMissingInstance } = referencesUtils

let id = 0
const newId = (): number => {
  id += 1
  return id
}

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

  const orgTypeName = new ObjectType({
    elemID: new ElemID(ZENDESK, ORG_FIELD_TYPE_NAME),
  })

  const groupType = new ObjectType({
    elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME),
  })

  const customObjectType = new ObjectType({
    elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_TYPE_NAME),
  })

  const customObjectFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_TYPE_NAME),
  })

  const dynamicContentRecord = new InstanceElement('dynamic_content_test', dynamicContentType, {
    placeholder: '{{dc.dynamic_content_test}}',
  })

  const hyphenDynamicContentRecord = new InstanceElement('dynamic-content-test', dynamicContentType, {
    placeholder: '{{dc.dynamic-content-test}}',
  })

  const missingDynamicContentRecord = new InstanceElement(
    'missing_not_exists',
    dynamicContentType,
    { placeholder: '{{dc.not_exists}}' },
    undefined,
    { salto_missing_ref: true },
  )

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

  const placeholder1 = new InstanceElement('placeholder1', placeholder1Type, { id: newId() })
  const placeholder2 = new InstanceElement('placeholder2', placeholder1Type, { id: newId() })
  const placeholder3 = new InstanceElement('placeholder3', placeholder1Type, { id: newId() })
  const placeholderOrganization1 = new InstanceElement('placeholder-org1', placeholder3Type, { key: 'org' })
  const placeholderOrganization2 = new InstanceElement('placeholder-org2', placeholder3Type, { key: 'org_123' })
  const placeholderUser1 = new InstanceElement('placeholder-user1', placeholder4Type, { key: 'user' })
  const placeholderUser2 = new InstanceElement('placeholder-user2', placeholder4Type, { key: 'user_123' })

  const macro1 = new InstanceElement('macro1', testType, {
    id: newId(),
    actions: [{ value: 'non template', field: 'comment_value_html' }],
  })
  const macro2 = new InstanceElement('macro2', testType, {
    id: newId(),
    actions: [{ value: `{{ticket.ticket_field_${placeholder1.value.id}}}`, field: 'comment_value' }],
  })
  const macro3 = new InstanceElement('macro3', testType, {
    id: newId(),
    actions: [
      {
        value: `multiple refs {{ticket.ticket_field_${placeholder1.value.id}}} and {{ticket.ticket_field_option_title_${placeholder2.value.id}}}`,
        field: 'comment_value_html',
      },
    ],
  })
  const macro4 = new InstanceElement('macro4', testType, {
    id: newId(),
    actions: [
      {
        value:
          'a lot of info like {{}} and  something that looks like a DC item, such as this email: rdc.blab@gmail.com',
        field: 'comment_value_html',
      },
    ],
  })

  const macroOrganization = new InstanceElement('macroOrg', testType, {
    id: newId(),
    actions: [
      {
        value:
          'multiple refs {{ticket.organization.custom_fields.org_123}} and {{ticket.organization.custom_fields.org}} and {{ticket.organization.custom_fields.org_123.title}}',
        field: 'comment_value_html',
      },
    ],
  })
  const macroUser = new InstanceElement('macroUser', testType, {
    id: newId(),
    actions: [
      {
        value:
          'multiple refs {{ticket.requester.custom_fields.user_123}} and {{ticket.requester.custom_fields.user}} and {{ticket.requester.custom_fields.user_123.title}}',
        field: 'comment_value_html',
      },
    ],
  })
  const macroMissingUserAndOrganization = new InstanceElement('macroMissingOrgAndUser', testType, {
    id: newId(),
    actions: [
      {
        value:
          'multiple refs {{ticket.requester.custom_fields.user1}} and {{ticket.requester.custom_fields.user1.title}} and {{ticket.organization.custom_fields.org1}} and {{ticket.organization.custom_fields.org1.title}}',
        field: 'comment_value_html',
      },
    ],
  })

  const macroComplicated = new InstanceElement('macroComplicated', testType, {
    id: newId(),
    actions: [
      {
        value: `{{some other irrelevancies-ticket.ticket_field_${placeholder1.value.id} | something irrelevant | dynamic content now: dc.not_dynamic_content_test | and done}}`,
        field: 'comment_value_html',
      },
    ],
  })
  const macroDifferentBracket = new InstanceElement('macroDifferentBracket', testType, {
    id: newId(),
    actions: [
      {
        value: `{%some other irrelevancies-ticket.ticket_field_${placeholder1.value.id} | something irrelevant | dynamic content now: dc.not_dynamic_content_test | and done%}`,
        field: 'comment_value_html',
      },
    ],
  })
  const macroWithSideConversationTicketTemplate = new InstanceElement('macroSideConvTicket', testType, {
    id: newId(),
    actions: [
      {
        value: [
          `Improved needs for {{ticket.ticket_field_option_title_${placeholder3.value.id}}}`,
          `<p>Improved needs for {{ticket.ticket_field_option_title_${placeholder3.value.id}}} due to something</p>`,
          'hello',
          'text/html',
        ],
        field: 'side_conversation_ticket',
      },
      {
        value: [
          `Improved needs for {{ticket.ticket_field_option_title_${placeholder3.value.id}}}`,
          `<p>Improved needs for {{ticket.ticket_field_option_title_${placeholder3.value.id}}} due to something</p>`,
          'hello',
          'text/html',
        ],
        field: 'side_conversation_slack',
      },
      {
        value: [
          `Improved needs for {{ticket.ticket_field_${placeholder1.value.id}}}`,
          `<p>Improved needs for {{ticket.ticket_field_${placeholder1.value.id}}} due to something</p>`,
          'hello',
          'text/html',
        ],
        field: 'side_conversation',
      },
      {
        value: `Improved needs for {{ticket.ticket_field_${placeholder1.value.id}}} - {{ticket.ticket_field_${placeholder1.value.id}}}`,
        field: 'subject',
      },
    ],
  })

  const macroWithDC = new InstanceElement('macroDynamicContent', testType, {
    id: newId(),
    actions: [
      {
        value: `dynamic content ref {{dc.dynamic_content_test}} and {{ticket.ticket_field_option_title_${placeholder2.value.id}}}`,
        field: 'comment_value_html',
      },
    ],
  })
  const macroWithHyphenDC = new InstanceElement('macroHyphenDynamicContent', testType, {
    id: newId(),
    actions: [
      {
        value: `dynamic content ref {{dc.dynamic-content-test}} and {{ticket.ticket_field_option_title_${placeholder2.value.id}}}`,
        field: 'comment_value_html',
      },
    ],
  })

  const macroAlmostTemplate = new InstanceElement('macroAlmost', testType, {
    id: newId(),
    actions: [
      {
        value: `almost template {{ticket.not_an_actual_field_${placeholder1.value.id}}} and {{ticket.ticket_field_0}}`,
        field: 'comment_value_html',
      },
    ],
  })
  const macroAlmostTemplate2 = new InstanceElement('macroAlmost2', testType, {
    id: newId(),
    actions: [{ value: `{{ticket.ticket_field_${placeholder1.value.id}}}`, field: 'not_template_field' }],
  })
  const target = new InstanceElement('target', targetType, {
    id: newId(),
    target_url: `url: {{ticket.ticket_field_${placeholder1.value.id}}}`,
  })
  const trigger = new InstanceElement('trigger', triggerType, {
    id: newId(),
    actions: [
      {
        field: 'notification_webhook',
        value: [
          ['my test', '{{dc.dynamic_content_test}}'],
          ['dcno', '{{dc.not_exists}}'],
          [
            'testJson',
            `{\n\t"ticket": {\n\t\t"custom_fields": [\n\t\t\t{\n\t\t\t\t"id": ${placeholder3.value.id},\n\t\t\t\t"testdc": "${dynamicContentRecord.value.placeholder}"\n\t\t\t}\n\t\t],\n\t\t"id": ${placeholder2.value.id}\n\t},\n\t"id": ${placeholder3.value.id}\n}\n`,
          ],
        ],
      },
    ],
  })
  const webhook = new InstanceElement('webhook', webhookType, {
    id: newId(),
    endpoint: `endpoint: {{ticket.ticket_field_${placeholder1.value.id}}}`,
  })
  const automation = new InstanceElement('automation', automationType, {
    id: newId(),
    actions: [{ value: `ticket: {{ticket.ticket_field_${placeholder1.value.id}}}`, field: 'notification_webhook' }],
  })
  const dynamicContent = new InstanceElement('dc', dynamicContentItemType, {
    id: newId(),
    content: `content: {{ticket.ticket_field_${placeholder1.value.id}}}`,
  })
  const dynamicContentWithEquals = new InstanceElement('dynamicContentWithEquals', dynamicContentItemType, {
    id: newId(),
    content: `content: {{ticket.ticket_field_${placeholder1.value.id}}}== true`,
  })

  const appInstallation = new InstanceElement('appInstallation', appInstallationType, {
    id: newId(),
    settings: { uri_templates: `template: {{ticket.ticket_field_${placeholder1.value.id}}}` },
    settings_objects: [
      { name: 'uri_templates', value: `object template: {{ticket.ticket_field_${placeholder1.value.id}}}` },
    ],
  })

  const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
    id: newId(),
  })

  const articleTranslation = new InstanceElement(
    'articleTranslation',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME) }),
    {
      body: `"/hc/test/test/articles/${article.value.id}/test\n"hc/test/test/articles/${macro1.value.id}/test`,
    },
  )

  const generateElements = (): (InstanceElement | ObjectType)[] =>
    [
      testType,
      placeholder1Type,
      placeholder2Type,
      placeholder1,
      placeholder2,
      macro1,
      macro2,
      macro3,
      macro4,
      macroAlmostTemplate,
      macroAlmostTemplate2,
      target,
      trigger,
      webhook,
      targetType,
      triggerType,
      webhookType,
      automation,
      automationType,
      dynamicContent,
      dynamicContentItemType,
      appInstallation,
      appInstallationType,
      macroWithDC,
      macroWithHyphenDC,
      dynamicContentRecord,
      dynamicContentWithEquals,
      hyphenDynamicContentRecord,
      macroComplicated,
      macroDifferentBracket,
      macroWithSideConversationTicketTemplate,
      placeholder3,
      placeholderOrganization1,
      placeholderOrganization2,
      placeholderUser1,
      placeholderUser2,
      macroOrganization,
      macroUser,
      macroMissingUserAndOrganization,
      article,
      articleTranslation,
    ].map(element => element.clone())

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
      const missingInstance = createMissingInstance(ZENDESK, 'ticket_field', '0')
      missingInstance.value.id = '0'
      expect(fetchedMacroAlmostTemplate?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `almost template {{ticket.not_an_actual_field_${placeholder1.value.id}}} and {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(missingInstance.elemID, missingInstance),
            '}}',
          ],
        }),
      )
      const fetchedMacroAlmostTemplate2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroAlmost2')
      expect(fetchedMacroAlmostTemplate2?.value.actions[0].value).toEqual(
        `{{ticket.ticket_field_${placeholder1.value.id}}}`,
      )
    })

    it('should resolve one template correctly, in any type', () => {
      const fetchedMacro2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro2')
      expect(fetchedMacro2?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [`{{${TICKET_TICKET_FIELD}_`, new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'],
        }),
      )
      const fetchedTarget = elements.filter(isInstanceElement).find(i => i.elemID.name === 'target')
      expect(fetchedTarget?.value.target_url).toEqual(
        new TemplateExpression({
          parts: [`url: {{${TICKET_TICKET_FIELD}_`, new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'],
        }),
      )
      const fetchedWebhook = elements.filter(isInstanceElement).find(i => i.elemID.name === 'webhook')
      expect(fetchedWebhook?.value.endpoint).toEqual(
        new TemplateExpression({
          parts: [
            `endpoint: {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
      )
      const fetchedTrigger = elements.filter(isInstanceElement).find(i => i.elemID.name === 'trigger')
      expect(fetchedTrigger?.value.actions[0].value).toEqual([
        [
          'my test',
          new TemplateExpression({
            parts: ['{{', new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord), '}}'],
          }),
        ],
        [
          'dcno',
          new TemplateExpression({
            parts: [
              '{{',
              new ReferenceExpression(missingDynamicContentRecord.elemID, missingDynamicContentRecord),
              '}}',
            ],
          }),
        ],
        [
          'testJson',
          new TemplateExpression({
            parts: [
              `{\n\t"ticket": {\n\t\t"custom_fields": [\n\t\t\t{\n\t\t\t\t"id": ${placeholder3.value.id},\n\t\t\t\t"testdc": "{{`,
              new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
              `}}"\n\t\t\t}\n\t\t],\n\t\t"id": ${placeholder2.value.id}\n\t},\n\t"id": ${placeholder3.value.id}\n}\n`,
            ],
          }),
        ],
      ])
      const fetchedAutomation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'automation')
      expect(fetchedAutomation?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `ticket: {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
      )
      const fetchedDynamicContent = elements.filter(isInstanceElement).find(i => i.elemID.name === 'dc')
      expect(fetchedDynamicContent?.value.content).toEqual(
        new TemplateExpression({
          parts: [
            `content: {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
      )
      const fetchedAppInstallation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'appInstallation')
      expect(fetchedAppInstallation?.value.settings.uri_templates).toEqual(
        new TemplateExpression({
          parts: [
            `template: {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
      )
      expect(fetchedAppInstallation?.value.settings_objects[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `object template: {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
      )
      const fetchedDCMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroDynamicContent')
      expect(fetchedDCMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            'dynamic content ref {{',
            new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
            `}} and {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder2.elemID, placeholder2),
            '}}',
          ],
        }),
      )

      const fetchedHyphenDCMacro = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'macroHyphenDynamicContent')
      expect(fetchedHyphenDCMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            'dynamic content ref {{',
            new ReferenceExpression(hyphenDynamicContentRecord.elemID, hyphenDynamicContentRecord),
            `}} and {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder2.elemID, placeholder2),
            '}}',
          ],
        }),
      )
    })

    it('should resolve more complicated templates correctly', () => {
      const fetchedMacroComplicated = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroComplicated')
      expect(fetchedMacroComplicated?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `{{some other irrelevancies-${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            ' | something irrelevant | dynamic content now: dc.not_dynamic_content_test | and done}}',
          ],
        }),
      )
      const fetchedMacroDifferentBracket = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'macroDifferentBracket')
      expect(fetchedMacroDifferentBracket?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `{%some other irrelevancies-${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            ' | something irrelevant | dynamic content now: dc.not_dynamic_content_test | and done%}',
          ],
        }),
      )
      const fetchedDynamicContentWithEquals = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'dynamicContentWithEquals')
      expect(fetchedDynamicContentWithEquals?.value.content).toEqual(
        new TemplateExpression({
          parts: [
            `content: {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}== true',
          ],
        }),
      )
    })

    it('should resolve multiple templates correctly', () => {
      const fetchedMacro3 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro3')
      expect(fetchedMacro3?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `multiple refs {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            `}} and {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder2.elemID, placeholder2),
            '}}',
          ],
        }),
      )
    })

    it('should not resolve strings that contain dc. if not in a placeholder', () => {
      const fetchedMacro4 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro4')
      expect(fetchedMacro4?.value.actions[0].value).toEqual(
        'a lot of info like {{}} and  something that looks like a DC item, such as this email: rdc.blab@gmail.com',
      )
    })

    it('should resolve side_conversation_ticket correctly', () => {
      const macroWithSideConv = elements
        .filter(isInstanceElement)
        .filter(i => i.elemID.name === 'macroSideConvTicket')[0]
      expect(macroWithSideConv).toBeDefined()
      expect(macroWithSideConv.value.actions[0].value).toEqual([
        new TemplateExpression({
          parts: [
            `Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder3.elemID, placeholder3),
            '}}',
          ],
        }),
        new TemplateExpression({
          parts: [
            `<p>Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder3.elemID, placeholder3),
            '}} due to something</p>',
          ],
        }),
        'hello',
        'text/html',
      ])
      expect(macroWithSideConv.value.actions[1].value).toEqual([
        new TemplateExpression({
          parts: [
            `Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder3.elemID, placeholder3),
            '}}',
          ],
        }),
        new TemplateExpression({
          parts: [
            `<p>Improved needs for {{${TICKET_TICKET_FIELD_OPTION_TITLE}_`,
            new ReferenceExpression(placeholder3.elemID, placeholder3),
            '}} due to something</p>',
          ],
        }),
        'hello',
        'text/html',
      ])
      expect(macroWithSideConv.value.actions[2].value).toEqual([
        new TemplateExpression({
          parts: [
            `Improved needs for {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
        new TemplateExpression({
          parts: [
            `<p>Improved needs for {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}} due to something</p>',
          ],
        }),
        'hello',
        'text/html',
      ])
      expect(macroWithSideConv.value.actions[3].value).toEqual(
        new TemplateExpression({
          parts: [
            `Improved needs for {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            `}} - {{${TICKET_TICKET_FIELD}_`,
            new ReferenceExpression(placeholder1.elemID, placeholder1),
            '}}',
          ],
        }),
      )
    })
    it('should resolve organization correctly', () => {
      const fetchedMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroOrg')
      expect(fetchedMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `multiple refs {{${TICKET_ORGANIZATION_FIELD}.`,
            new ReferenceExpression(placeholderOrganization2.elemID, placeholderOrganization2),
            `}} and {{${TICKET_ORGANIZATION_FIELD}.`,
            new ReferenceExpression(placeholderOrganization1.elemID, placeholderOrganization1),
            `}} and {{${TICKET_ORGANIZATION_FIELD}.`,
            new ReferenceExpression(placeholderOrganization2.elemID, placeholderOrganization2),
            '.title}}',
          ],
        }),
      )
    })
    it('should resolve requester correctly', () => {
      const fetchedMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroUser')
      expect(fetchedMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({
          parts: [
            `multiple refs {{${TICKET_USER_FIELD}.`,
            new ReferenceExpression(placeholderUser2.elemID, placeholderUser2),
            `}} and {{${TICKET_USER_FIELD}.`,
            new ReferenceExpression(placeholderUser1.elemID, placeholderUser1),
            `}} and {{${TICKET_USER_FIELD}.`,
            new ReferenceExpression(placeholderUser2.elemID, placeholderUser2),
            '.title}}',
          ],
        }),
      )
    })
    it('should resolve as missing for organization and requester', () => {
      const fetchedMacro = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroMissingOrgAndUser')
      const missingOrgInstance = createMissingInstance(ZENDESK, ORG_FIELD_TYPE_NAME, 'org1')
      const missingUserInstance = createMissingInstance(ZENDESK, USER_FIELD_TYPE_NAME, 'user1')
      missingOrgInstance.value.key = 'org1'
      missingUserInstance.value.key = 'user1'
      expect(fetchedMacro?.value.actions[0].value).toEqual(
        new TemplateExpression({
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
        }),
      )
    })
    it('should not resolve urls when the config flag is off', async () => {
      const fetchedArticleTranslation = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'articleTranslation')
      expect(fetchedArticleTranslation?.value.body).toEqual(
        `"/hc/test/test/articles/${article.value.id}/test\n"hc/test/test/articles/${macro1.value.id}/test`,
      )
    })
    it('should resolve urls correctly when config flags are on', async () => {
      elements = generateElements()
      const config = _.cloneDeep(DEFAULT_CONFIG)
      config[FETCH_CONFIG].extractReferencesFromFreeText = true
      config[FETCH_CONFIG].convertJsonIdsToReferences = true
      const resolveLinksFilter = filterCreator(createFilterCreatorParams({ config })) as FilterType
      await resolveLinksFilter.onFetch(elements)

      const fetchedArticleTranslation = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'articleTranslation')
      expect(fetchedArticleTranslation?.value.body).toEqual(
        new TemplateExpression({
          parts: [
            '"/hc/test/test/articles/',
            new ReferenceExpression(article.elemID, article),
            '/test\n"hc/test/test/articles/',
            new ReferenceExpression(macro1.elemID, macro1),
            '/test',
          ],
        }),
      )

      const fetchedTrigger = elements.filter(isInstanceElement).find(i => i.elemID.name === 'trigger')
      expect(fetchedTrigger?.value.actions[0].value[2][1]).toEqual(
        new TemplateExpression({
          parts: [
            '{\n\t"ticket": {\n\t\t"custom_fields": [\n\t\t\t{\n\t\t\t\t"id": ',
            new ReferenceExpression(placeholder3.elemID, placeholder3),
            ',\n\t\t\t\t"testdc": "{{',
            new ReferenceExpression(dynamicContentRecord.elemID, dynamicContentRecord),
            '}}"\n\t\t\t}\n\t\t],\n\t\t"id": ',
            new ReferenceExpression(placeholder2.elemID, placeholder2),
            '\n\t},\n\t"id": ',
            new ReferenceExpression(placeholder3.elemID, placeholder3),
            '\n}\n',
          ],
        }),
      )
    })
  })
  describe('preDeploy', () => {
    it('Returns elements to origin after predeploy', async () => {
      const elementsBeforeFetch = generateElements()
      const elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      expect(elementsAfterPreDeploy).toEqual(elementsBeforeFetch)
    })

    it('handle links correctly with extractReferencesFromFreeText config', async () => {
      const config = _.cloneDeep(DEFAULT_CONFIG)
      config[FETCH_CONFIG].extractReferencesFromFreeText = true
      const resolveLinksFilter = filterCreator(createFilterCreatorParams({ config })) as FilterType

      const elementsBeforeFetch = generateElements()
      const elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await resolveLinksFilter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await resolveLinksFilter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
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

  describe('prepRef', () => {
    it("should return 'key' field or 'undefined' on ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE", () => {
      const validOrg = new InstanceElement('instance', orgTypeName, { key: 'test' })
      const invalidOrg = new InstanceElement('instance', orgTypeName, { noKey: 'test' })
      const invalidOrgRef = new ReferenceExpression(invalidOrg.elemID, invalidOrg)

      const validPrepRef = prepRef(new ReferenceExpression(validOrg.elemID, validOrg))
      const invalidPrepRef = prepRef(invalidOrgRef)

      expect(validPrepRef).toEqual('test')
      expect(invalidPrepRef).toEqual('undefined')
    })
    it("should return 'placeholder' field or the instance reference on dynamic_content_item type", () => {
      const validDynamicContent = new InstanceElement('instance', dynamicContentType, { placeholder: '{{dc.test}}' })
      const invalidDynamicContent = new InstanceElement('instance', dynamicContentType, { placeholder: 'invalid' })
      const invalidDynamicContentRef = new ReferenceExpression(invalidDynamicContent.elemID, invalidDynamicContent)

      const validPrepRef = prepRef(new ReferenceExpression(validDynamicContent.elemID, validDynamicContent))
      const invalidPrepRef = prepRef(invalidDynamicContentRef)

      expect(validPrepRef).toEqual('dc.test')
      expect(invalidPrepRef).toEqual(invalidDynamicContentRef)
    })
    it("should return 'id' field or the instance reference on group type", () => {
      const validGroup = new InstanceElement('instance', groupType, { id: 123 })
      const invalidGroup = new InstanceElement('instance', groupType, { noId: 123 })
      const invalidGroupRef = new ReferenceExpression(invalidGroup.elemID, invalidGroup)

      const validPrepRef = prepRef(new ReferenceExpression(validGroup.elemID, validGroup))
      const invalidPrepRef = prepRef(invalidGroupRef)

      expect(validPrepRef).toEqual('123')
      expect(invalidPrepRef).toEqual(invalidGroupRef)
    })
    it("should return 'key' field or the instance reference on custom_object and custom_object_field type", () => {
      const validCustomObject = new InstanceElement('instance', customObjectType, { key: 'test' })
      const invalidCustomObject = new InstanceElement('instance', customObjectType, { noKey: 'test' })
      const invalidCustomObjectRef = new ReferenceExpression(invalidCustomObject.elemID, invalidCustomObject)

      const validCustomObjectField = new InstanceElement('instance', customObjectFieldType, { key: 'test' })
      const invalidCustomObjectField = new InstanceElement('instance', customObjectFieldType, { noKey: 'test' })
      const invalidCustomObjectFieldRef = new ReferenceExpression(
        invalidCustomObjectField.elemID,
        invalidCustomObjectField,
      )

      const validCustomObjectPrepRef = prepRef(new ReferenceExpression(validCustomObject.elemID, validCustomObject))
      const invalidCustomObjectPrepRef = prepRef(invalidCustomObjectRef)

      const validCustomObjectFieldPrepRef = prepRef(
        new ReferenceExpression(validCustomObjectField.elemID, validCustomObjectField),
      )
      const invalidCustomObjectFieldPrepRef = prepRef(invalidCustomObjectFieldRef)

      expect(validCustomObjectPrepRef).toEqual('test')
      expect(invalidCustomObjectPrepRef).toEqual(invalidCustomObjectRef)

      expect(validCustomObjectFieldPrepRef).toEqual('test')
      expect(invalidCustomObjectFieldPrepRef).toEqual(invalidCustomObjectFieldRef)
    })
    it('should return an empty string on UnresolvedReference', () => {
      const elemId = new ElemID(ZENDESK, 'test')
      const unresolvedRef = new UnresolvedReference(elemId)
      const unresolvedPrepRef = prepRef(new ReferenceExpression(elemId, unresolvedRef))

      expect(unresolvedPrepRef).toEqual('')
    })
  })
})
