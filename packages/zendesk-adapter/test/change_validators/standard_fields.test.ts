/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import { standardFieldsValidator } from '../../src/change_validators'

describe('standardFieldsValidator', () => {
  const standardField = new InstanceElement(
    'standardField',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') }),
    {
      type: 'status',
      raw_title: 'Status',
    },
  )

  const nonStandardField = standardField.clone()
  nonStandardField.value.type = 'custom'

  it('should return an error for addition or removal of standard ticket field', async () => {
    const errors = await standardFieldsValidator([
      toChange({ after: standardField }),
      toChange({ before: standardField }),
    ])
    expect(errors).toHaveLength(2)
    expect(errors).toMatchObject([
      {
        elemID: standardField.elemID,
        severity: 'Error',
        message: 'Cannot add or remove standard ticket fields',
        detailedMessage: 'Standard ticket fields cannot be added or removed in Zendesk',
      },
      {
        elemID: standardField.elemID,
        severity: 'Error',
        message: 'Cannot add or remove standard ticket fields',
        detailedMessage: 'Standard ticket fields cannot be added or removed in Zendesk',
      },
    ])
  })

  it('should return an error for modification of non-editable field in standard ticket field', async () => {
    const clonedInstance = standardField.clone()
    clonedInstance.value.raw_title = 'Updated Status'
    const errors = await standardFieldsValidator([toChange({ before: standardField, after: clonedInstance })])
    expect(errors).toMatchObject([
      {
        elemID: standardField.elemID,
        severity: 'Error',
        message: 'Cannot edit [type, raw_title] fields of standard ticket fields',
        detailedMessage: 'Editing [type, raw_title] fields of standard ticket fields is not supported in Zendesk',
      },
    ])
  })

  it('should not return an error for addition or removal of non-standard field', async () => {
    const errors = await standardFieldsValidator([
      toChange({ after: nonStandardField }),
      toChange({ before: nonStandardField }),
    ])
    expect(errors).toHaveLength(0)
  })

  it('should not return an error for modification of an editable field in standard field', async () => {
    const clonedInstance = standardField.clone()
    clonedInstance.value.someEditableField = 'Updated Value'
    const errors = await standardFieldsValidator([toChange({ before: standardField, after: clonedInstance })])
    expect(errors).toHaveLength(0)
  })
})
