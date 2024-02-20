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
  BuiltinTypes,
  ChangeValidator,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  BRAND_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { notEnabledMissingReferencesValidator } from '../../src/change_validators'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

// dynamicContentReferencesFilter requires the actual type, otherwise it deletes the value
const triggerType = new ObjectType({
  elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME),
  fields: {
    actions: {
      refType: new ListType(
        new ObjectType({
          elemID: new ElemID(ZENDESK, 'trigger__actions'),
          fields: {
            field: { refType: BuiltinTypes.STRING },
            value: { refType: BuiltinTypes.STRING },
          },
        }),
      ),
    },
    conditions: {
      refType: new ObjectType({
        elemID: new ElemID(ZENDESK, 'trigger__conditions'),
        fields: {
          all: {
            refType: new ListType(
              new ObjectType({
                elemID: new ElemID(ZENDESK, 'trigger__conditions__all'),
                fields: {
                  field: { refType: BuiltinTypes.STRING },
                  operator: { refType: BuiltinTypes.STRING },
                  value: { refType: BuiltinTypes.STRING },
                },
              }),
            ),
          },
        },
      }),
    },
  },
})
// dynamicContentReferencesFilter requires the actual type, otherwise it deletes the value
const articleType = new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
  fields: {
    id: { refType: BuiltinTypes.NUMBER },
  },
})
// dynamicContentReferencesFilter requires the actual type, otherwise it deletes the value
const articleTranslationType = new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME),
  fields: {
    body: { refType: BuiltinTypes.STRING },
  },
})
// dynamicContentReferencesFilter requires the actual type, otherwise it deletes the value
const brandType = new ObjectType({
  elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  fields: {
    subdomain: { refType: BuiltinTypes.STRING },
    brand_url: { refType: BuiltinTypes.STRING },
    has_help_center: { refType: BuiltinTypes.BOOLEAN },
    name: { refType: BuiltinTypes.STRING },
    id: { refType: BuiltinTypes.NUMBER },
  },
})

describe('notEnabledMissingReferencesValidator', () => {
  let validator: ChangeValidator
  beforeEach(() => {
    const config = _.cloneDeep(DEFAULT_CONFIG)
    config[FETCH_CONFIG].enableMissingReferences = false
    config[FETCH_CONFIG].guide = {
      ...config[FETCH_CONFIG].guide,
      brands: (config[FETCH_CONFIG].guide?.brands ?? []).concat('brand'),
    }
    validator = notEnabledMissingReferencesValidator(config)
  })

  it('sideConversationsFilter', async () => {
    const trigger = new InstanceElement('trigger', triggerType, {
      actions: [
        {
          field: 'side_conversation_ticket',
          value: ['test', '<p>test</p>', 'SupportAssignable:support_assignable/group/124+sufix', 'text/htmll'],
        },
      ],
    })
    const errors = await validator([toChange({ before: trigger, after: trigger })])
    expect(errors).toMatchObject([
      {
        elemID: trigger.elemID,
        severity: 'Warning',
        message: 'Element includes missing references',
        detailedMessage:
          'This element includes the following missing references\n' +
          '.actions.0.value.2 -> group (124)\n' +
          'Deploying this element may fail or cause unpredictable behaviour in the service',
      },
    ])
  })

  it('fieldReferencesFilter', async () => {
    const trigger = new InstanceElement('trigger', triggerType, {
      conditions: {
        all: [{ field: 'brand_id', operator: 'is', value: 'you_like_crazy' }],
      },
    })
    const errors = await validator([toChange({ after: trigger })])
    expect(errors).toMatchObject([
      {
        elemID: trigger.elemID,
        severity: 'Warning',
        message: 'Element includes missing references',
        detailedMessage:
          'This element includes the following missing references\n' +
          '.conditions.all.0.value -> brand (you_like_crazy)\n' +
          'Deploying this element may fail or cause unpredictable behaviour in the service',
      },
    ])
  })

  it('listValuesMissingReferencesFilter', async () => {
    const trigger = new InstanceElement('trigger', triggerType, {
      actions: [{ field: 'notification_sms_group', value: ['123456789', '+123456678', 'sms message'] }],
    })
    const errors = await validator([toChange({ after: trigger })])
    expect(errors).toMatchObject([
      {
        elemID: trigger.elemID,
        severity: 'Warning',
        message: 'Element includes missing references',
        detailedMessage:
          'This element includes the following missing references\n' +
          '.actions.0.value.0 -> group (123456789)\n' +
          'Deploying this element may fail or cause unpredictable behaviour in the service',
      },
    ])
  })

  it('dynamicContentReferencesFilter', async () => {
    const noDCInstance = new InstanceElement(
      'instance',
      new ObjectType({
        elemID: new ElemID(ZENDESK, 'someType'),
        fields: {
          raw_value: { refType: BuiltinTypes.STRING },
          empty_value: { refType: new ListType(BuiltinTypes.NUMBER) },
        },
      }),
      {
        raw_value: '{{dc.notExistsPlaceholder}}',
      },
    )
    const errors = await validator([toChange({ after: noDCInstance })])
    expect(errors).toMatchObject([
      {
        elemID: noDCInstance.elemID,
        severity: 'Warning',
        message: 'Element includes missing references',
        detailedMessage:
          'This element includes the following missing references\n' +
          '.raw_value -> dynamic_content_item (notExistsPlaceholder)\n' +
          'Deploying this element may fail or cause unpredictable behaviour in the service',
      },
    ])
  })

  it('articleBodyFilter', async () => {
    const brand = new InstanceElement('brand', brandType, {
      subdomain: 'brand',
      brand_url: 'https://brand.zendesk.com',
      has_help_center: true,
      name: 'brand',
      id: 1,
    })
    const parentArticle = new InstanceElement('articleParent', articleType, { id: 124 })
    const translation = new InstanceElement(
      'translationWithEmptyBrand',
      articleTranslationType,
      {
        body: '<p><a href="https://brand.zendesk.com/hc/en-us/articles/124/sep/sections/123/sep/categories/123/sep/article_attachments/123-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/123-extra_string"',
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )
    const errors = await validator([
      toChange({ after: translation }),
      toChange({ after: brand }), // The brand needs to exist in order for the filter to run
    ])
    expect(errors).toMatchObject([
      {
        elemID: translation.elemID,
        severity: 'Warning',
        message: 'Element includes missing references',
        detailedMessage:
          'This element includes the following missing references\n' +
          '.body -> article (brand_124)\n' +
          '.body -> section (brand_123)\n' +
          '.body -> category (brand_123)\n' +
          '.body -> article_attachment (brand_123)\n' +
          '.body -> article (brand_123)\n' +
          'Deploying this element may fail or cause unpredictable behaviour in the service',
      },
    ])
  })

  it('handleTemplateExpressionFilter', async () => {
    const trigger = new InstanceElement('trigger', triggerType, {
      actions: [
        {
          value: 'almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1455}}',
          field: 'side_conversation_ticket',
        },
      ],
    })
    const errors = await validator([toChange({ after: trigger })])
    expect(errors).toMatchObject([
      {
        elemID: trigger.elemID,
        severity: 'Warning',
        message: 'Element includes missing references',
        detailedMessage:
          'This element includes the following missing references\n' +
          '.actions.0.value -> ticket_field (1455)\n' +
          'Deploying this element may fail or cause unpredictable behaviour in the service',
      },
    ])
  })
})
