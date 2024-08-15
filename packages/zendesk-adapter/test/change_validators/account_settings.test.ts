/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import { accountSettingsValidator } from '../../src/change_validators/account_settings'

describe('accountSettingsValidator', () => {
  const accountSettings = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID(ZENDESK, 'account_setting') }),
    {
      branding: {
        header_color: '03363E',
        page_background_color: '333333',
        tab_background_color: '7FA239',
        text_color: 'FFFFFF',
      },
      routing: {
        enabled: false,
        autorouting_tag: '',
        max_email_capacity: 1,
        max_messaging_capacity: 1,
      },
    },
  )
  it('should return an error when we change autorouting_tag to be empty', async () => {
    const clonedInstance = accountSettings.clone()
    clonedInstance.value.routing.autorouting_tag = 'Test'
    const errors = await accountSettingsValidator([toChange({ before: clonedInstance, after: accountSettings })])
    expect(errors).toEqual([
      {
        elemID: accountSettings.elemID,
        severity: 'Error',
        message: 'Cannot change an auto-routing tag to an empty value',
        detailedMessage: 'routing.autorouting_tag cannot be empty',
      },
    ])
  })
  it('should not return an error when we change autorouting_tag to not be empty', async () => {
    const clonedInstance = accountSettings.clone()
    clonedInstance.value.routing.autorouting_tag = 'Test'
    const errors = await accountSettingsValidator([toChange({ before: clonedInstance, after: clonedInstance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if autorouting_tag is already empty', async () => {
    const errors = await accountSettingsValidator([toChange({ before: accountSettings, after: accountSettings })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if autorouting_tag is not exist', async () => {
    const clonedInstance = accountSettings.clone()
    delete clonedInstance.value.routing
    const errors = await accountSettingsValidator([toChange({ before: clonedInstance, after: clonedInstance })])
    expect(errors).toHaveLength(0)
  })
})
