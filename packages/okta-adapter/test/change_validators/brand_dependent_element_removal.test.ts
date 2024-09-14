/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { brandDependentElementRemovalValidator } from '../../src/change_validators/brand_dependent_element_removal'
import { OKTA, BRAND_THEME_TYPE_NAME, EMAIL_TEMPLATE, BRAND_TYPE_NAME } from '../../src/constants'

describe('brandDependentElementRemovalValidator', () => {
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const brandThemeType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME) })
  const emailTemplateType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_TEMPLATE) })

  const brand = new InstanceElement('brand', brandType, { id: 'brandId123' })
  const brandTheme = new InstanceElement('user type', brandThemeType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)],
  })
  const emailTemplate = new InstanceElement('email template', emailTemplateType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)],
  })

  it.each([brandTheme, emailTemplate])(
    'should return an error when brand dependent element is deleted without its Brand',
    async instance => {
      const changeErrors = await brandDependentElementRemovalValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Error',
          message: `Cannot remove ${instance.elemID.typeName} if its brand is not also being removed`,
          detailedMessage: 'In order to remove this element, remove its brand as well',
        },
      ])
    },
  )
  it.each([brandTheme, emailTemplate])(
    'should not return an error when brand dependent element is deleted with its brand',
    async instance => {
      const changeErrors = await brandDependentElementRemovalValidator([
        toChange({ before: brand }),
        toChange({ before: instance }),
      ])
      expect(changeErrors).toHaveLength(0)
    },
  )
})
