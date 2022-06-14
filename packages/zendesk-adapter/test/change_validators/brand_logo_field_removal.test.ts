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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { BRAND_LOGO_TYPE_NAME, BRAND_NAME, ZENDESK_SUPPORT } from '../../src/constants'
import { brandLogoFieldRemovalValidator } from '../../src/change_validators/brand_logo_field_removal'

describe('brandLogoFieldRemovalValidator', () => {
  const logoType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, BRAND_LOGO_TYPE_NAME),
  })
  const logoInstance = new InstanceElement('brand_logo', logoType, {})
  const anotherLogoInstance = new InstanceElement('another_brand_logo', logoType, {})
  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, BRAND_NAME),
  })
  const brandInstance = new InstanceElement(
    'New Test',
    brandType,
    { name: 'test', subdomain: 'subdomain_test' },
  )
  const brandInstanceWithoutLogo = brandInstance.clone()
  const brandInstanceWithLogo = brandInstance.clone()
  brandInstanceWithLogo.value.logo = new ReferenceExpression(logoInstance.elemID)
  it('should return an error if logo field is removed without removing the brand_logo instance', async () => {
    const errors = await brandLogoFieldRemovalValidator(
      [
        toChange({ before: brandInstanceWithLogo, after: brandInstanceWithoutLogo }),
        toChange({ before: anotherLogoInstance })],
    )
    expect(errors).toEqual([{
      elemID: brandInstance.elemID,
      severity: 'Error',
      message: `Error while trying to remove the brand_logo field while its instance still exists for brand ${brandInstance.value.name}`,
      detailedMessage: `Error while trying to remove the brand_logo field while its instance still exists for brand ${brandInstance.value.name}`,
    }])
  })
  it('should not return an error if the logo is removed', async () => {
    const errors = await brandLogoFieldRemovalValidator(
      [
        toChange({ before: brandInstanceWithLogo, after: brandInstanceWithoutLogo }),
        toChange({ before: logoInstance })],
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the non-logo field is being removed from brand instance', async () => {
    const brandInstanceWithoutUrl = brandInstance.clone()
    const brandInstanceWithUrl = brandInstance.clone()
    brandInstanceWithUrl.value.brand_url = 'brand_url'
    const errors = await brandLogoFieldRemovalValidator(
      [toChange({ before: brandInstanceWithUrl, after: brandInstanceWithoutUrl })]
    )
    expect(errors).toHaveLength(0)
  })
})
