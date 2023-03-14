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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK, MACRO_TYPE_NAME, ACCOUNT_FEATURES_TYPE_NAME } from '../../src/constants'
import { sideConversationsValidator } from '../../src/change_validators'

describe('macro side conversation fields', () => {
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
  const featureType = new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME) })

  it('should return an error when macro contains disabled side conversation fields', async () => {
    const macroInstance1 = new InstanceElement(
      'test',
      macroType,
      {
        title: 'test',
        actions: [
          {
            field: 'comment_value_html',
            value: '<p>Test</p>',
          },
          {
            field: 'side_conversation_ticket',
            value: ['fwd: {{ticket.title}} (Ticket #{{ticket.id}}', 'text/html'],
          },
        ],
      }
    )
    const macroInstance2 = new InstanceElement(
      'test',
      macroType,
      {
        title: 'test',
        actions: [
          {
            field: 'side_conversation',
            value: ['test', 'text/html'],
          },
          {
            field: 'side_conversation',
            value: ['test', 'text/html'],
          },
          {
            field: 'comment_value_html',
            value: '<p>Test</p>',
          },
          {
            field: 'side_conversation_slack',
            value: ['fwd: {{ticket.title}} (Ticket #{{ticket.id}}', '<p>test</p>'],
          },
        ],
      }
    )
    const featureInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      featureType,
      {
        macro_preview: {
          enabled: true,
        },
        side_conversations_email: {
          enabled: false,
        },
        side_conversations_slack: {
          enabled: false,
        },
        side_conversations_tickets: {
          enabled: false,
        },
      },
    )
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance1 }), toChange({ after: macroInstance2 })],
      buildElementsSourceFromElements([featureInstance])
    )
    expect(errors).toHaveLength(2)
    expect(errors[0]).toEqual({
      elemID: macroInstance1.elemID,
      severity: 'Error',
      message: 'Cannot change a macro with side conversation actions since the feature is disabled in the account',
      detailedMessage: `Macro contains the following side conversation actions which are disabled in the account: side_conversation_ticket.
Please enable side conversations in your account or remove those actions from the macro in order to deploy.`,
    })
    expect(errors[1]).toEqual({
      elemID: macroInstance2.elemID,
      severity: 'Error',
      message: 'Cannot change a macro with side conversation actions since the feature is disabled in the account',
      detailedMessage: `Macro contains the following side conversation actions which are disabled in the account: side_conversation, side_conversation_slack.
Please enable side conversations in your account or remove those actions from the macro in order to deploy.`,
    })
  })
  it('should not return an error when all macro side conversation fields are enabled', async () => {
    const macroInstance = new InstanceElement(
      'test',
      macroType,
      {
        title: 'test',
        actions: [
          {
            field: 'comment_value_html',
            value: '<p>Test</p>',
          },
          {
            field: 'side_conversation_ticket',
            value: ['fwd: {{ticket.title}} (Ticket #{{ticket.id}}', 'text/html'],
          },
          {
            field: 'side_conversation_slack',
            value: ['fwd: {{ticket.title}} (Ticket #{{ticket.id}}', '<p>test</p>'],
          },
        ],
      }
    )
    const featureInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      featureType,
      {
        macro_preview: {
          enabled: true,
        },
        side_conversations_email: {
          enabled: false,
        },
        side_conversations_slack: {
          enabled: true,
        },
        side_conversations_tickets: {
          enabled: true,
        },
      },
    )
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance })],
      buildElementsSourceFromElements([featureInstance])
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when macro has no side conversation fields', async () => {
    const macroInstance = new InstanceElement(
      'test',
      macroType,
      {
        title: 'test',
        actions: [
          {
            field: 'comment_value_html',
            value: '<p>Test</p>',
          },
        ],
      }
    )
    const featureInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      featureType,
      {
        macro_preview: {
          enabled: true,
        },
        side_conversations_email: {
          enabled: false,
        },
        side_conversations_slack: {
          enabled: true,
        },
        side_conversations_tickets: {
          enabled: false,
        },
      },
    )
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance })],
      buildElementsSourceFromElements([featureInstance])
    )
    expect(errors).toHaveLength(0)
  })
  it('should return nothing if feature instance is missing', async () => {
    const macroInstance = new InstanceElement(
      'test',
      macroType,
      {
        title: 'test',
        actions: [
          {
            field: 'side_conversation_ticket',
            value: ['fwd: {{ticket.title}} (Ticket #{{ticket.id}}', 'text/html'],
          },
          {
            field: 'comment_value_html',
            value: '<p>Test</p>',
          },
        ],
      }
    )
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance })],
      buildElementsSourceFromElements([])
    )
    expect(errors).toHaveLength(0)
  })
})
