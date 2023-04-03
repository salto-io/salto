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
    'category',
    categoryType,
    {
      brand: new ReferenceExpression(brandWithHelpCenterFalse.elemID, brandWithHelpCenterFalse),
    }
  )

  const categoryToBrandWithHelpCenterTrue = new InstanceElement(
    'category',
    categoryType,
    {
      brand: new ReferenceExpression(brandWithHelpCenterTrue.elemID, brandWithHelpCenterTrue),
    }
  )

  it('should return errors because the brand has no help center', async () => {
    const changes = [toChange({ after: categoryToBrandWithHelpCenterFalse })]
    const changesErrors = await guideDisabledValidator(changes)
    expect(changesErrors).toHaveLength(1)
    expect(changesErrors).toEqual([{
      elemID: categoryToBrandWithHelpCenterFalse.elemID,
      severity: 'Error',
      message: 'Cannot add instance because its associated brand has help center disabled.',
      detailedMessage: `The brand "${brandWithHelpCenterFalse.elemID.name}" associated with this instance has help center disabled.`,
    }])
  })

  it('should not return errors because the brand has help center', async () => {
    const changes = [toChange({ after: categoryToBrandWithHelpCenterTrue })]
    const changesErrors = await guideDisabledValidator(changes)
    expect(changesErrors).toHaveLength(0)
  })
})
