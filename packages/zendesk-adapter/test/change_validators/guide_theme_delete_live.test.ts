/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { guideThemeDeleteLiveValidator } from '../../src/change_validators/guide_theme_delete_live'
import { BRAND_TYPE_NAME, GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'

describe('guideThemeDeleteLiveValidator', () => {
  const guideThemeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
  const themeSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, THEME_SETTINGS_TYPE_NAME) })

  const brand = new InstanceElement('brand', brandType, { id: 1, name: 'oneTwo', has_help_center: true })
  const guideThemeLiveInstance = new InstanceElement('guideThemeInstance', guideThemeType, {
    name: 'guideThemeInstance',
    live: true,
    brand_id: new ReferenceExpression(brand.elemID),
  })
  const guideThemeNotLiveInstance = new InstanceElement('guideThemeInstanceNotLive', guideThemeType, {
    name: 'guideThemeInstanceNotLive',
    live: false,
    brand_id: new ReferenceExpression(brand.elemID),
  })

  const themeSettingsInstance = new InstanceElement(`${brand.elemID.getFullName()}_settings`, themeSettingsType, {
    brand: new ReferenceExpression(brand.elemID),
    liveTheme: new ReferenceExpression(guideThemeLiveInstance.elemID),
  })

  it('should return error when deleting live theme', async () => {
    const changeErrors = await guideThemeDeleteLiveValidator(
      [toChange({ before: guideThemeLiveInstance })],
      buildElementsSourceFromElements([themeSettingsInstance]),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeLiveInstance.elemID)
    expect(changeErrors[0].message).toEqual('Cannot delete live themes')
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual('Cannot delete live themes, please unpublish the theme first')
  })

  it('should not return error when deleting non-live theme', async () => {
    const changeErrors = await guideThemeDeleteLiveValidator(
      [toChange({ before: guideThemeNotLiveInstance })],
      buildElementsSourceFromElements([themeSettingsInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
