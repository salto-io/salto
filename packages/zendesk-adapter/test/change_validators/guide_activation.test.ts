/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import { helpCenterActivationValidator } from '../../src/change_validators'


describe('helpCenterActivationValidator', () => {
  const BrandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const brandOneInstance = new InstanceElement(
    'Test1',
    BrandType,
    {
      help_center_state: 'enabled',
      has_help_center: true,
      brand_url: 'https://free-tifder.zendesk.com',
    },
  )

  it('should return an error when help_center_state is changed', async () => {
    const brandTwoInstance = new InstanceElement(
      'Test2',
      BrandType,
      {
        help_center_state: 'restricted',
        has_help_center: true,
        brand_url: 'https://free-tifder.zendesk.com',
      },
    )
    const errors = await helpCenterActivationValidator(
      [toChange({ before: brandOneInstance, after: brandTwoInstance })]
    )
    expect(errors).toEqual([{
      elemID: brandTwoInstance.elemID,
      severity: 'Warning',
      message: 'Activation or deactivation of help center for a certain brand is not supported via Salto.',
      detailedMessage: `Activation or deactivation of help center for a certain brand is not supported via Salto. To activate or deactivate a help center, please go to ${brandTwoInstance.value.brand_url}/hc/admin/general_settings`,
    }])
  })

  it('should not return an error when help_center_state is not changed', async () => {
    const brandTwoInstance = new InstanceElement(
      'Test2',
      BrandType,
      {
        help_center_state: 'enabled',
        has_help_center: true,
        brand_url: 'https://free.zendesk.com',
      },
    )
    const errors = await helpCenterActivationValidator(
      [toChange({ before: brandOneInstance, after: brandTwoInstance })]
    )
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when the change is addition', async () => {
    const errors = await helpCenterActivationValidator(
      [toChange({ after: brandOneInstance })]
    )
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when the change is removal', async () => {
    const errors = await helpCenterActivationValidator(
      [toChange({ before: brandOneInstance })]
    )
    expect(errors).toHaveLength(0)
  })
})
