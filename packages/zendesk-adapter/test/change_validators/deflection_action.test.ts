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
import { elementSource } from '@salto-io/workspace'
import { AUTOMATION_TYPE_NAME, MACRO_TYPE_NAME, TRIGGER_TYPE_NAME, ZENDESK } from '../../src/constants'
import { ACCOUNT_SETTING_TYPE_NAME } from '../../src/filters/account_settings'
import { DEFLECTION_TYPE, deflectionActionValidator } from '../../src/change_validators/deflection_action'

const { createInMemoryElementSource } = elementSource

const createTestInstance = (type: string, isDeflection: boolean): InstanceElement => new InstanceElement(
  type,
  new ObjectType({ elemID: new ElemID(ZENDESK, type) }),
  {
    actions: [
      {
        field: isDeflection ? 'deflection' : 'current_tags',
        value: [],
      },
    ],
  },
)

describe('deflectionActionValidator', () => {
  const accountSettingType = new ObjectType({
    elemID: new ElemID(ZENDESK, ACCOUNT_SETTING_TYPE_NAME),
  })
  const deflectionTrigger = createTestInstance(TRIGGER_TYPE_NAME, true)
  const deflectionAutomation = createTestInstance(AUTOMATION_TYPE_NAME, true)
  const deflectionMacro = createTestInstance(MACRO_TYPE_NAME, true)
  const accountSetting = new InstanceElement(
    '_config',
    accountSettingType,
    {
      active_features: {
        automatic_answers: true,
      },
    }
  )

  it('should return error if automatic_answers in disabled', async () => {
    const invalidAccountSetting = accountSetting.clone()
    invalidAccountSetting.value.active_features.automatic_answers = false
    const tempElementSource = createInMemoryElementSource([invalidAccountSetting])
    const changes = [
      toChange({ after: deflectionTrigger }),
      toChange({ after: deflectionAutomation }),
      toChange({ after: deflectionMacro }),
    ]

    const errors = await deflectionActionValidator(changes, tempElementSource)
    expect(errors).toMatchObject([
      {
        elemID: deflectionTrigger.elemID,
        severity: 'Error',
        message: 'Cannot change this element since one of its action types is not supported',
        detailedMessage: `Action field '${DEFLECTION_TYPE}' is not supported, please turn on automatic answers in your account settings`,
      },
      {
        elemID: deflectionAutomation.elemID,
        severity: 'Error',
        message: 'Cannot change this element since one of its action types is not supported',
        detailedMessage: `Action field '${DEFLECTION_TYPE}' is not supported, please turn on automatic answers in your account settings`,
      },
      {
        elemID: deflectionMacro.elemID,
        severity: 'Error',
        message: 'Cannot change this element since one of its action types is not supported',
        detailedMessage: `Action field '${DEFLECTION_TYPE}' is not supported, please turn on automatic answers in your account settings`,
      },
    ])
  })

  it('should return nothing if automatic_answers in enabled', async () => {
    const tempElementSource = createInMemoryElementSource([accountSetting])
    const changes = [
      toChange({ after: deflectionTrigger }),
      toChange({ after: deflectionAutomation }),
      toChange({ after: deflectionMacro }),
    ]

    const errors = await deflectionActionValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })

  it('should return nothing if no instance is of action deflection ', async () => {
    const trigger = createTestInstance(TRIGGER_TYPE_NAME, false)
    const automation = createTestInstance(AUTOMATION_TYPE_NAME, false)
    const macro = createTestInstance(MACRO_TYPE_NAME, false)

    const changes = [toChange({ after: trigger }), toChange({ after: automation }), toChange({ after: macro })]
    const errors = await deflectionActionValidator(changes)

    expect(errors).toHaveLength(0)
  })
  it('should return nothing if there are relevant changes but not element source', async () => {
    const changes = [toChange({ after: deflectionTrigger })]
    const errors = await deflectionActionValidator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should return nothing if the account settings is not valid', async () => {
    const invalidAccountSetting = accountSetting.clone()
    invalidAccountSetting.value.active_features.automatic_answers = 'string'
    const tempElementSource = createInMemoryElementSource([invalidAccountSetting])
    const changes = [toChange({ after: deflectionTrigger })]

    const errors = await deflectionActionValidator(changes, tempElementSource)
    expect(errors).toHaveLength(0)
  })
})
