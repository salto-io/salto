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
    }
  )
  it('should return an error when we change autorouting_tag to be empty', async () => {
    const clonedInstance = accountSettings.clone()
    clonedInstance.value.routing.autorouting_tag = 'Test'
    const errors = await accountSettingsValidator([
      toChange({ before: clonedInstance, after: accountSettings }),
    ])
    expect(errors).toEqual([{
      elemID: accountSettings.elemID,
      severity: 'Error',
      message: 'Cannot change an auto-routing tag to an empty value',
      detailedMessage: 'routing.autorouting_tag cannot be empty',
    }])
  })
  it('should not return an error when we change autorouting_tag to not be empty', async () => {
    const clonedInstance = accountSettings.clone()
    clonedInstance.value.routing.autorouting_tag = 'Test'
    const errors = await accountSettingsValidator([
      toChange({ before: clonedInstance, after: clonedInstance }),
    ])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if autorouting_tag is already empty', async () => {
    const errors = await accountSettingsValidator([
      toChange({ before: accountSettings, after: accountSettings }),
    ])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if autorouting_tag is not exist', async () => {
    const clonedInstance = accountSettings.clone()
    delete clonedInstance.value.routing
    const errors = await accountSettingsValidator([
      toChange({ before: clonedInstance, after: clonedInstance }),
    ])
    expect(errors).toHaveLength(0)
  })
})
