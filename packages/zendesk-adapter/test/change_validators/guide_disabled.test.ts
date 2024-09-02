/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { guideDisabledValidator } from '../../src/change_validators'
import { ZENDESK, CATEGORY_TYPE_NAME } from '../../src/constants'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const msgForNoHelpCenter = 'Cannot add this element because help center is not enabled for its associated brand.'
const msgNotInConfig = 'Cannot add this element because its associated brand is not enabled in the configuration.'
describe('guideDisabledValidator', () => {
  const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, 'brand') })
  const brandWithHelpCenterFalse = new InstanceElement('brandWithHelpCenterFalse', brandType, {
    name: 'brandWithHelpCenterFalse',
    has_help_center: false,
  })

  const brandWithHelpCenterTrue = new InstanceElement('brandWithHelpCenterTrue', brandType, {
    name: 'brandWithHelpCenterTrue',
    has_help_center: true,
  })

  const categoryToBrandWithHelpCenterFalse = new InstanceElement('categoryToBrandWithHelpCenterFalse', categoryType, {
    brand: new ReferenceExpression(brandWithHelpCenterFalse.elemID, brandWithHelpCenterFalse),
  })

  const categoryToBrandWithHelpCenterTrue = new InstanceElement('categoryToBrandWithHelpCenterTrue', categoryType, {
    brand: new ReferenceExpression(brandWithHelpCenterTrue.elemID, brandWithHelpCenterTrue),
  })

  it('should return errors because the brand has no help center', async () => {
    const clonedBrandWithHelpCenterFalse = brandWithHelpCenterFalse.clone()
    const changes = [toChange({ after: categoryToBrandWithHelpCenterFalse })]
    const fetchConfig = { ...DEFAULT_CONFIG[FETCH_CONFIG], guide: { brands: ['.*'] } }
    const validtor = guideDisabledValidator(fetchConfig)
    const changesErrors = await validtor(changes, buildElementsSourceFromElements([clonedBrandWithHelpCenterFalse]))
    expect(changesErrors).toHaveLength(1)
    expect(changesErrors).toEqual([
      {
        elemID: categoryToBrandWithHelpCenterFalse.elemID,
        severity: 'Error',
        message: msgForNoHelpCenter,
        detailedMessage: `Please enable help center for brand "${brandWithHelpCenterFalse.elemID.name}" in order to add this element.`,
      },
    ])
  })

  it('should not return errors because the brand has help center', async () => {
    const clonedBrandWithHelpCenterTrue = brandWithHelpCenterTrue.clone()
    const changes = [toChange({ after: categoryToBrandWithHelpCenterTrue })]
    const fetchConfig = { ...DEFAULT_CONFIG[FETCH_CONFIG], guide: { brands: ['.*'] } }
    const validtor = guideDisabledValidator(fetchConfig)
    const changesErrors = await validtor(changes, buildElementsSourceFromElements([clonedBrandWithHelpCenterTrue]))
    expect(changesErrors).toHaveLength(0)
  })
  it('should not return errors for edge cases', async () => {
    const fetchConfig = { ...DEFAULT_CONFIG[FETCH_CONFIG], guide: { brands: ['.*'] } }
    const brandWitouthHelpCenter = new InstanceElement('brandWitouthHelpCenter', brandType, {})

    const categoryWithoutRefExpression = new InstanceElement('categoryWithoutRefExpression', categoryType, {
      brand: 'not a reference expression',
    })
    const categoryWithoutBrand = new InstanceElement('categoryWithoutBrand', categoryType, {})
    const clonedBrandWitouthHelpCenter = brandWitouthHelpCenter.clone()
    const validator = guideDisabledValidator(fetchConfig)
    const changes = [toChange({ after: categoryWithoutRefExpression }), toChange({ after: categoryWithoutBrand })]
    const changesErrors = await validator(changes, buildElementsSourceFromElements([clonedBrandWitouthHelpCenter]))
    expect(changesErrors).toHaveLength(0)
  })
  it('should return errors because the brand is not include in the config', async () => {
    const clonedBrandWithHelpCenterTrue = brandWithHelpCenterTrue.clone()
    const changes = [toChange({ after: categoryToBrandWithHelpCenterTrue })]
    const fetchConfig = { ...DEFAULT_CONFIG[FETCH_CONFIG], guide: { brands: ['.L'] } }
    const validtor = guideDisabledValidator(fetchConfig)
    const changesErrors = await validtor(changes, buildElementsSourceFromElements([clonedBrandWithHelpCenterTrue]))
    expect(changesErrors).toHaveLength(1)
    expect(changesErrors).toEqual([
      {
        elemID: categoryToBrandWithHelpCenterTrue.elemID,
        severity: 'Error',
        message: msgNotInConfig,
        detailedMessage: `Please enable the brand "${brandWithHelpCenterTrue.elemID.name}" in the configuration in order to add this element.`,
      },
    ])
  })
  it('should return errors because there is no guide in the config', async () => {
    const clonedBrandWithHelpCenterTrue = brandWithHelpCenterTrue.clone()
    const changes = [toChange({ after: categoryToBrandWithHelpCenterTrue })]
    const fetchConfig = { ...DEFAULT_CONFIG[FETCH_CONFIG] }
    const validtor = guideDisabledValidator(fetchConfig)
    const changesErrors = await validtor(changes, buildElementsSourceFromElements([clonedBrandWithHelpCenterTrue]))
    expect(changesErrors).toHaveLength(1)
    expect(changesErrors).toEqual([
      {
        elemID: categoryToBrandWithHelpCenterTrue.elemID,
        severity: 'Error',
        message: msgNotInConfig,
        detailedMessage: `Please enable the brand "${brandWithHelpCenterTrue.elemID.name}" in the configuration in order to add this element.`,
      },
    ])
  })
})
