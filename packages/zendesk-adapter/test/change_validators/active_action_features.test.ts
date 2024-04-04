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
import { elementSource } from '@salto-io/workspace'
import {
  AUTOMATION_TYPE_NAME,
  CUSTOM_TICKET_STATUS_ACTION,
  DEFLECTION_ACTION,
  MACRO_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { ACCOUNT_SETTING_TYPE_NAME } from '../../src/filters/account_settings'
import { activeActionFeaturesValidator } from '../../src/change_validators'
import {
  CUSTOM_TICKET_STATUS_ZENDESK_FIELD,
  DEFLECTION_ZENDESK_FIELD,
} from '../../src/change_validators/active_action_features'

const { createInMemoryElementSource } = elementSource

const createTestInstance = (type: string, field?: string): InstanceElement =>
  new InstanceElement(type, new ObjectType({ elemID: new ElemID(ZENDESK, type) }), {
    actions: [
      {
        field: field ?? 'test',
        value: [],
      },
    ],
  })

describe('activeActionFeaturesValidator', () => {
  let deflectionTrigger: InstanceElement
  let deflectionAutomation: InstanceElement
  let deflectionMacro: InstanceElement
  let customTicketStatusTrigger: InstanceElement
  let accountSetting: InstanceElement

  beforeEach(() => {
    deflectionTrigger = createTestInstance(TRIGGER_TYPE_NAME, DEFLECTION_ACTION)
    deflectionAutomation = createTestInstance(AUTOMATION_TYPE_NAME, DEFLECTION_ACTION)
    deflectionMacro = createTestInstance(MACRO_TYPE_NAME, DEFLECTION_ACTION)
    customTicketStatusTrigger = createTestInstance(TRIGGER_TYPE_NAME, CUSTOM_TICKET_STATUS_ACTION)
    accountSetting = new InstanceElement(
      '_config',
      new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_SETTING_TYPE_NAME) }),
      {
        active_features: {
          automatic_answers: true,
        },
        tickets: {
          custom_statuses_enabled: true,
        },
      },
    )
  })
  it('should return error if the features are disabled', async () => {
    accountSetting.value.active_features.automatic_answers = false
    accountSetting.value.tickets.custom_statuses_enabled = false
    const tempElementSource = createInMemoryElementSource([accountSetting])
    const changes = [
      toChange({ after: deflectionTrigger }),
      toChange({ after: deflectionAutomation }),
      toChange({ after: deflectionMacro }),
      toChange({ after: customTicketStatusTrigger }),
    ]

    const errors = await activeActionFeaturesValidator(changes, tempElementSource)
    expect(errors).toMatchObject([
      {
        elemID: deflectionTrigger.elemID,
        severity: 'Error',
        message: 'Action requires turning on automatic_answers feature',
        detailedMessage: `To enable the configuration of the '${DEFLECTION_ACTION}' field action, which allows for '${DEFLECTION_ZENDESK_FIELD}', please ensure that the automatic_answers feature is turned on. To do so, please update the 'active_features.automatic_answers' setting to 'true' in the account_settings.`,
      },
      {
        elemID: deflectionAutomation.elemID,
        severity: 'Error',
        message: 'Action requires turning on automatic_answers feature',
        detailedMessage: `To enable the configuration of the '${DEFLECTION_ACTION}' field action, which allows for '${DEFLECTION_ZENDESK_FIELD}', please ensure that the automatic_answers feature is turned on. To do so, please update the 'active_features.automatic_answers' setting to 'true' in the account_settings.`,
      },
      {
        elemID: deflectionMacro.elemID,
        severity: 'Error',
        message: 'Action requires turning on automatic_answers feature',
        detailedMessage: `To enable the configuration of the '${DEFLECTION_ACTION}' field action, which allows for '${DEFLECTION_ZENDESK_FIELD}', please ensure that the automatic_answers feature is turned on. To do so, please update the 'active_features.automatic_answers' setting to 'true' in the account_settings.`,
      },
      {
        elemID: customTicketStatusTrigger.elemID,
        severity: 'Error',
        message: 'Action requires turning on custom_statuses_enabled feature',
        detailedMessage: `To enable the configuration of the '${CUSTOM_TICKET_STATUS_ACTION}' field action, which allows for '${CUSTOM_TICKET_STATUS_ZENDESK_FIELD}', please ensure that the custom_statuses_enabled feature is turned on. To do so, please update the 'tickets.custom_statuses_enabled' setting to 'true' in the account_settings.`,
      },
    ])
  })

  it('should return nothing if features are enabled', async () => {
    const tempElementSource = createInMemoryElementSource([accountSetting])
    const changes = [
      toChange({ after: deflectionTrigger }),
      toChange({ after: deflectionAutomation }),
      toChange({ after: deflectionMacro }),
      toChange({ after: customTicketStatusTrigger }),
    ]

    const errors = await activeActionFeaturesValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })

  it("should return nothing if no instance is of a feature's action ", async () => {
    accountSetting.value.active_features.automatic_answers = false
    accountSetting.value.tickets.custom_statuses_enabled = false
    const elementsSource = createInMemoryElementSource([accountSetting])
    const trigger = createTestInstance(TRIGGER_TYPE_NAME)
    const automation = createTestInstance(AUTOMATION_TYPE_NAME)
    const macro = createTestInstance(MACRO_TYPE_NAME)

    const changes = [toChange({ after: trigger }), toChange({ after: automation }), toChange({ after: macro })]
    const errors = await activeActionFeaturesValidator(changes, elementsSource)

    expect(errors).toHaveLength(0)
  })
  it('should return nothing if there are relevant changes but no element source', async () => {
    accountSetting.value.active_features.automatic_answers = false
    accountSetting.value.tickets.custom_statuses_enabled = false
    const changes = [toChange({ after: deflectionTrigger }), toChange({ after: customTicketStatusTrigger })]
    const errors = await activeActionFeaturesValidator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should return nothing if the account settings is not valid', async () => {
    accountSetting.value = { test: 'test' }
    const tempElementSource = createInMemoryElementSource([accountSetting])
    const changes = [toChange({ after: deflectionTrigger }), toChange({ after: customTicketStatusTrigger })]

    const errors = await activeActionFeaturesValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })
})
