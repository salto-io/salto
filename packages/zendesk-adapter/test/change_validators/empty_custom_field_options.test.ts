/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK, CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/constants'
import { emptyCustomFieldOptionsValidator } from '../../src/change_validators'

describe('emptyCustomFieldOptionsValidator', () => {
  const userFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_field') })
  const userField = new InstanceElement('field1', userFieldType, {
    key: 'test1',
    title: 'test',
    type: 'dropdown',
    [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [],
  })
  it('should return an error when we add field with no options', async () => {
    const errors = await emptyCustomFieldOptionsValidator([toChange({ after: userField })])
    expect(errors).toEqual([
      {
        elemID: userField.elemID,
        severity: 'Error',
        message: 'Cannot make this change since dropdown, tagger and multi-select fields can’t to be empty',
        detailedMessage: 'Custom field options are required for dropdown, tagger and multi select fields',
      },
    ])
  })
  it('should not return an error when we remove a field', async () => {
    const errors = await emptyCustomFieldOptionsValidator([toChange({ before: userField })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when there are options', async () => {
    const clonedUserField = userField.clone()
    const userFieldOption = new InstanceElement(
      'option1',
      new ObjectType({ elemID: new ElemID(ZENDESK, 'user_field__custom_field_options') }),
      { name: 'v1', value: 'v1' },
    )
    clonedUserField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(userFieldOption.elemID, userFieldOption),
    ]
    const errors = await emptyCustomFieldOptionsValidator([toChange({ after: clonedUserField })])
    expect(errors).toHaveLength(0)
  })
})
