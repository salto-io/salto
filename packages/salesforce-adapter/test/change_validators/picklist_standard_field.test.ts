/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Field, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import changeValidator from '../../src/change_validators/picklist_standard_field'
import { FIELD_ANNOTATIONS, VALUE_SET_FIELDS } from '../../src/constants'
import { createField } from '../utils'
import { mockInstances, mockTypes } from '../mock_elements'

describe('picklist standard field change validator', () => {
  let fieldWithValueSet: Field
  let customFieldWithValueSet: Field
  let fieldWithStandardValueSet: Field
  let fieldWithNoValueSet: Field

  beforeEach(() => {
    const customObject = mockTypes.Account.clone()
    const svsInstance = mockInstances().StandardValueSet
    fieldWithValueSet = createField(customObject, Types.primitiveDataTypes.Picklist, 'Account.StandardPicklist', {
      [FIELD_ANNOTATIONS.VALUE_SET]: [{ fullName: 'testValue1', default: true, label: 'Test Value 1' }],
    })
    customFieldWithValueSet = createField(
      customObject,
      Types.primitiveDataTypes.Picklist,
      'Account.CustomPicklist__c',
      {
        [FIELD_ANNOTATIONS.VALUE_SET]: [{ fullName: 'testValue1', default: true, label: 'Test Value 1' }],
      },
    )
    fieldWithStandardValueSet = createField(
      customObject,
      Types.primitiveDataTypes.Picklist,
      'Account.PicklistWithSVS',
      {
        [VALUE_SET_FIELDS.VALUE_SET_NAME]: new ReferenceExpression(svsInstance.elemID, svsInstance),
      },
    )
    fieldWithNoValueSet = createField(customObject, Types.primitiveDataTypes.Picklist, 'Account.PicklistWithNoValueSet')
  })
  it('should create errors for standard picklist fields with valueSet', async () => {
    const errors = await changeValidator(
      [fieldWithValueSet, customFieldWithValueSet, fieldWithStandardValueSet, fieldWithNoValueSet].map(field =>
        toChange({ before: field, after: field }),
      ),
    )
    expect(errors).toEqual([
      expect.objectContaining({
        elemID: fieldWithValueSet.elemID,
        severity: 'Error',
      }),
    ])
  })
})
