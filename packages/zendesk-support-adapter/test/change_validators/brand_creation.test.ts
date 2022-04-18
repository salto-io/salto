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
import { BRAND_NAME, ZENDESK_SUPPORT } from '../../src/constants'
import { brandCreationValidator } from '../../src/change_validators/brand_creation'

describe('brandCreationValidator', () => {
  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, BRAND_NAME),
  })
  const brandInstance = new InstanceElement(
    'New Test',
    brandType,
    { name: 'test', subdomain: 'subdomain_test' },
  )
  it('should return a warning if a new brand is created', async () => {
    const errors = await brandCreationValidator(
      [toChange({ after: brandInstance })],
    )
    expect(errors).toEqual([{
      elemID: brandInstance.elemID,
      severity: 'Warning',
      message: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${brandInstance.value.name} before attempting to create it from Salto`,
      detailedMessage: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${brandInstance.value.name} before attempting to create it from Salto`,
    }])
  })
  it('should not return an error if the brand was modified', async () => {
    const clonedBeforeBrand = brandInstance.clone()
    const clonedAfterBrand = brandInstance.clone()
    clonedAfterBrand.value.subdomain = 'edited'
    const errors = await brandCreationValidator(
      [toChange({ before: clonedBeforeBrand, after: clonedAfterBrand })],
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the brand was removed', async () => {
    const errors = await brandCreationValidator(
      [toChange({ before: brandInstance })],
    )
    expect(errors).toHaveLength(0)
  })
})
