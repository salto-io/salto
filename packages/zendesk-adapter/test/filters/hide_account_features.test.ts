/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK, ACCOUNT_FEATURES_TYPE_NAME } from '../../src/constants'
import hideAccountFeatureInstanceFilter from '../../src/filters/hide_account_features'
import { createFilterCreatorParams } from '../utils'

describe('hideAccountFeatureInstanceFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  const filter = hideAccountFeatureInstanceFilter(createFilterCreatorParams({})) as FilterType
  const featureType = new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME) })

  it('should add "_hidden_value" annotation to account_features type', async () => {
    const elements = [featureType]
    await filter.onFetch(elements)
    expect(elements[0]).toBeDefined()
    expect(elements[0]?.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toEqual(true)
  })
})
