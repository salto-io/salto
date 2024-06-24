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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK, MACRO_TYPE_NAME, ACCOUNT_FEATURES_TYPE_NAME, TRIGGER_TYPE_NAME } from '../../src/constants'
import { sideConversationsValidator } from '../../src/change_validators'

describe('instance side conversation fields', () => {
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) })
  const featureType = new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME) })

  it('should return an error when instance contains disabled side conversation fields', async () => {
    const beforeValue = {
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
    const afterValue = {
      title: 'test',
      actions: [
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
    const beforeMacro = new InstanceElement('test', macroType, beforeValue)
    const afterMacro = new InstanceElement('test', macroType, afterValue)
    const beforeTrigger = new InstanceElement('test', triggerType, beforeValue)
    const afterTrigger = new InstanceElement('test', triggerType, afterValue)
    const featureInstance = new InstanceElement(ElemID.CONFIG_NAME, featureType, {
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
    })
    const errors = await sideConversationsValidator(
      [
        toChange({ after: beforeMacro }),
        toChange({ after: afterMacro }),
        toChange({ after: beforeTrigger }),
        toChange({ after: afterTrigger }),
      ],
      buildElementsSourceFromElements([featureInstance]),
    )
    expect(errors).toHaveLength(4)
    expect(errors[0]).toEqual({
      elemID: beforeMacro.elemID,
      severity: 'Error',
      message: 'Cannot change a macro with side conversation actions since the feature is disabled in the account',
      detailedMessage: `macro contains the following side conversation actions which are disabled in the account: side_conversation_ticket.
Please enable side conversations in your account or remove those actions from the macro in order to deploy.`,
    })
    expect(errors[1]).toEqual({
      elemID: beforeMacro.elemID,
      severity: 'Error',
      message: 'Cannot change a macro with side conversation actions since the feature is disabled in the account',
      detailedMessage: `macro contains the following side conversation actions which are disabled in the account: side_conversation, side_conversation_slack.
Please enable side conversations in your account or remove those actions from the macro in order to deploy.`,
    })
    expect(errors[2]).toEqual({
      elemID: beforeTrigger.elemID,
      severity: 'Error',
      message: 'Cannot change a trigger with side conversation actions since the feature is disabled in the account',
      detailedMessage: `trigger contains the following side conversation actions which are disabled in the account: side_conversation_ticket.
Please enable side conversations in your account or remove those actions from the trigger in order to deploy.`,
    })
    expect(errors[3]).toEqual({
      elemID: beforeTrigger.elemID,
      severity: 'Error',
      message: 'Cannot change a trigger with side conversation actions since the feature is disabled in the account',
      detailedMessage: `trigger contains the following side conversation actions which are disabled in the account: side_conversation, side_conversation_slack.
Please enable side conversations in your account or remove those actions from the trigger in order to deploy.`,
    })
  })
  it('should not return an error when all instance side conversation fields are enabled', async () => {
    const instanceValue = {
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
    const macroInstance = new InstanceElement('test', macroType, instanceValue)
    const triggerInstance = new InstanceElement('test', triggerType, instanceValue)
    const featureInstance = new InstanceElement(ElemID.CONFIG_NAME, featureType, {
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
    })
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance }), toChange({ after: triggerInstance })],
      buildElementsSourceFromElements([featureInstance]),
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when instance has no side conversation fields', async () => {
    const instanceValue = {
      title: 'test',
      actions: [
        {
          field: 'comment_value_html',
          value: '<p>Test</p>',
        },
      ],
    }
    const macroInstance = new InstanceElement('test', macroType, instanceValue)
    const triggerInstance = new InstanceElement('test', triggerType, instanceValue)
    const featureInstance = new InstanceElement(ElemID.CONFIG_NAME, featureType, {
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
    })
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance }), toChange({ after: triggerInstance })],
      buildElementsSourceFromElements([featureInstance]),
    )
    expect(errors).toHaveLength(0)
  })
  it('should return nothing if feature instance is missing', async () => {
    const macroInstance = new InstanceElement('test', macroType, {
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
    })
    const errors = await sideConversationsValidator(
      [toChange({ after: macroInstance })],
      buildElementsSourceFromElements([]),
    )
    expect(errors).toHaveLength(0)
  })
})
