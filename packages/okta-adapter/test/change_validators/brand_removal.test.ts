/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { brandRemovalValidator } from '../../src/change_validators/brand_removal'
import { OKTA, BRAND_TYPE_NAME } from '../../src/constants'

describe('brandRemovalValidator', () => {
  const type = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const brand = new InstanceElement('mybrand', type, {})

  it('should return a warning when removing a brand', async () => {
    expect(await brandRemovalValidator([toChange({ before: brand })])).toEqual([
      {
        elemID: brand.elemID,
        severity: 'Warning',
        message: 'Brand removal includes all of its theme assets, custom code, emails, pages, and settings',
        detailedMessage:
          'Deleting this brand will remove all of its theme assets, custom code, emails, pages, and settings. This action is not reversible.',
      },
    ])
  })

  it('should not return a warning when adding a brand', async () => {
    expect(await brandRemovalValidator([toChange({ after: brand })])).toEqual([])
  })

  it('should not return a warning when modifying a brand', async () => {
    expect(await brandRemovalValidator([toChange({ before: brand, after: brand })])).toEqual([])
  })
})
