/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_alias'
import { BRAND_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'

describe('add alias filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: ZendeskClient

  const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
  const themeSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, THEME_SETTINGS_TYPE_NAME) })

  const brandInstance = new InstanceElement(
    'brand',
    brandType,
    {
      name: 'brand1',
    },
    undefined,
    { [CORE_ANNOTATIONS.ALIAS]: 'brand1' },
  )

  const themeSettingInstance = new InstanceElement('themeSetting', themeSettingsType, {
    name: 'setting',
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
  })

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(
      createFilterCreatorParams({
        client,
      }),
    ) as FilterType
  })

  describe('onFetch', () => {
    it('should add alias annotation correctly', async () => {
      const elements = [brandInstance, themeSettingInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual(['brand1', 'brand1 Theme settings'])
    })
  })
})
