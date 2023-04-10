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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { guideDisabledValidator } from '../../src/change_validators/guide_disabled'
import { ZENDESK, CATEGORY_TYPE_NAME } from '../../src/constants'


describe('guideDisabledValidator', () => {
  const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, 'brand') })

  const brandWithHelpCenterFalse = new InstanceElement(
    'brandWithHelpCenterFalse',
    brandType,
    {
      has_help_center: false,
    }
  )

  const brandWithHelpCenterTrue = new InstanceElement(
    'brandWithHelpCenterTrue',
    brandType,
    {
      has_help_center: true,
    }
  )

  const categoryToBrandWithHelpCenterFalse = new InstanceElement(
    'categoryToBrandWithHelpCenterFalse',
    categoryType,
    {
      brand: new ReferenceExpression(brandWithHelpCenterFalse.elemID, brandWithHelpCenterFalse),
    }
  )

  const categoryToBrandWithHelpCenterTrue = new InstanceElement(
    'categoryToBrandWithHelpCenterTrue',
    categoryType,
    {
      brand: new ReferenceExpression(brandWithHelpCenterTrue.elemID, brandWithHelpCenterTrue),
    }
  )

  it('should return errors because the brand has no help center', async () => {
    const clonedBrandWithHelpCenterFalse = brandWithHelpCenterFalse.clone()
    const changes = [toChange({ after: categoryToBrandWithHelpCenterFalse })]
    const changesErrors = await guideDisabledValidator(changes,
      buildElementsSourceFromElements([clonedBrandWithHelpCenterFalse]))
    expect(changesErrors).toHaveLength(1)
    expect(changesErrors).toEqual([{
      elemID: categoryToBrandWithHelpCenterFalse.elemID,
      severity: 'Error',
      message: 'Cannot add this element because help center is not enabled for its associated brand.',
      detailedMessage: `please enable help center for brand "${brandWithHelpCenterFalse.elemID.name}" in order to add this element.`,
    }])
  })

  it('should not return errors because the brand has help center', async () => {
    const clonedBrandWithHelpCenterTrue = brandWithHelpCenterTrue.clone()
    const changes = [toChange({ after: categoryToBrandWithHelpCenterTrue })]
    const changesErrors = await guideDisabledValidator(changes,
      buildElementsSourceFromElements([clonedBrandWithHelpCenterTrue]))
    expect(changesErrors).toHaveLength(0)
  })
  it('should not return errors for edge cases', async () => {
    const brandWitouthHelpCenter = new InstanceElement(
      'brandWitouthHelpCenter',
      brandType,
      {},
    )
    const categoryToBrandWitouthHelpCenter = new InstanceElement(
      'categoryToBrandWitouthHelpCenter',
      categoryType,
      {
        brand: new ReferenceExpression(brandWitouthHelpCenter.elemID, brandWitouthHelpCenter),
      }
    )
    const categoryWithoutRefExpression = new InstanceElement(
      'categoryWithoutRefExpression',
      categoryType,
      {
        brand: 'not a reference expression',
      }
    )
    const categoryWithoutBrand = new InstanceElement(
      'categoryWithoutBrand',
      categoryType,
      {
      },
    )
    const clonedBrandWitouthHelpCenter = brandWitouthHelpCenter.clone()
    const changes = [toChange({ after: categoryToBrandWitouthHelpCenter }),
      toChange({ after: categoryWithoutRefExpression }), toChange({ after: categoryWithoutBrand })]
    const changesErrors = await guideDisabledValidator(changes,
      buildElementsSourceFromElements([clonedBrandWitouthHelpCenter]))
    expect(changesErrors).toHaveLength(0)
  })
})
