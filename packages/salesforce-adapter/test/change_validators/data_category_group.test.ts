/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/data_category_group'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('DataCategoryGroup ChangeValidator', () => {
  const afterRecord = createInstanceElement({ fullName: 'obj__c.record' }, mockTypes.DataCategoryGroup)

  it('should have warning when trying to add a new data category group', async () => {
    const changeErrors = await changeValidator([toChange({ after: afterRecord })])
    expect(changeErrors).toEqual([
      expect.objectContaining({
        elemID: afterRecord.elemID,
        severity: 'Warning',
      }),
    ])
  })
})
