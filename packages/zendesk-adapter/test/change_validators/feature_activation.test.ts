/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import { ACCOUNT_SETTING_TYPE_NAME } from '../../src/filters/account_settings'
import { featureActivationValidator } from '../../src/change_validators'

describe('featureActivationValidator', () => {
  const accountSetting = new InstanceElement(
    '_config',
    new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_SETTING_TYPE_NAME) }),
    { active_features: {} },
  )

  it('should warn on activation of features', async () => {
    const before = accountSetting.clone()
    const after = accountSetting.clone()
    before.value.active_features = {
      a: false,
      b: false,
      c: false,
      d: true,
    }
    after.value.active_features = {
      a: true,
      b: true,
      c: false,
      d: true,
      e: true,
    }

    const errors = await featureActivationValidator([toChange({ before, after })])
    expect(errors).toMatchObject([
      {
        elemID: accountSetting.elemID,
        severity: 'Info',
        message: 'Activating new features may include additional cost',
        detailedMessage:
          'Features a, b, e are marked for activation and may require additional cost in order to operate',
      },
    ])
  })

  it('should return nothing if no feature was activated', async () => {
    const before = accountSetting.clone()
    const after = accountSetting.clone()
    before.value.active_features = {
      a: false,
      b: true,
    }
    after.value.active_features = {
      a: false,
      b: true,
    }

    const errors = await featureActivationValidator([toChange({ before, after })])
    expect(errors).toHaveLength(0)
  })

  it('should return nothing if account setting was not changed', async () => {
    const errors = await featureActivationValidator([])
    expect(errors).toHaveLength(0)
  })
})
