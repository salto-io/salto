/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { CUSTOM_STATUS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { customStatusCategoryChangeValidator } from '../../src/change_validators'

describe('customStatusCategoryChangeValidator', () => {
  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })
  const createStatus = (category: string, id: number): InstanceElement =>
    new InstanceElement(`${category}`, customStatusType, {
      id,
      status_category: category,
      active: true,
    })
  const pending = createStatus('pending', 1)

  it('should not return a warning when the change is not in the category', async () => {
    const afterPending = pending.clone()
    afterPending.value.active = false
    const errors = await customStatusCategoryChangeValidator([toChange({ before: pending, after: afterPending })])
    expect(errors).toEqual([])
  })
  it('should return a warning when the change is in the category', async () => {
    const afterPending = pending.clone()
    afterPending.value.status_category = 'solved'
    const errors = await customStatusCategoryChangeValidator([toChange({ before: pending, after: afterPending })])
    expect(errors).toEqual([
      {
        elemID: afterPending.elemID,
        severity: 'Error',
        message: 'Cannot modify custom status category.',
        detailedMessage: 'Modifying the category of a custom status is not supported in zendesk.',
      },
    ])
  })
})
