/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { SALESFORCE } from '../../src/constants'
import filterCreator from '../../src/filters/omit_standard_fields_non_deployable_values'
import { STANDARD_VALUE_SET } from '../../src/filters/standard_value_sets'
import { Types } from '../../src/transformers/transformer'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('omitStandardFieldsNonDeployableValues filter', () => {
  let filter: FilterWith<'onFetch'>
  beforeEach(() => {
    filter = filterCreator({
      config: defaultFilterContext,
    }) as FilterWith<'onFetch'>
  })
  describe('onFetch', () => {
    const STANDARD_PICKLIST_FIELD = 'StandardPicklist'
    const CUSTOM_PICKLIST_FIELD = 'CustomPicklist__c'
    const STANDARD_VALUE_SET_FIELD = 'SVSPicklist'

    let testObject: ObjectType

    beforeEach(() => {
      testObject = createCustomObjectType('TestObject__c', {
        fields: {
          [STANDARD_PICKLIST_FIELD]: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations: {
              apiName: STANDARD_PICKLIST_FIELD,
              valueSet: [{ fullName: 'value1', default: true, label: 'value1' }],
              referenceTo: ['Case', 'User'],
            },
          },
          [CUSTOM_PICKLIST_FIELD]: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations: {
              apiName: CUSTOM_PICKLIST_FIELD,
              valueSet: [{ fullName: 'value1', default: true, label: 'value1' }],
              referenceTo: ['Case', 'User'],
            },
          },
          [STANDARD_VALUE_SET_FIELD]: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations: {
              apiName: STANDARD_VALUE_SET_FIELD,
              valueSetName: new ReferenceExpression(
                new ElemID(SALESFORCE, STANDARD_VALUE_SET, 'instance', 'TestStandardValueSet'),
              ),
              referenceTo: ['Case', 'User'],
            },
          },
        },
      })
    })

    it('should omit valueSet and referenceTo from standard fields', async () => {
      await filter.onFetch([testObject])
      const standardPicklistField = testObject.fields[STANDARD_PICKLIST_FIELD]
      expect(standardPicklistField).toBeDefined()
      expect(standardPicklistField.annotations.valueSet).toBeUndefined()
      expect(standardPicklistField.annotations.referenceTo).toBeUndefined()

      // Custom Picklist Fields should remain unchanged
      const customPicklistField = testObject.fields[CUSTOM_PICKLIST_FIELD]
      expect(customPicklistField).toBeDefined()
      expect(customPicklistField.annotations.valueSet).toBeDefined()
      expect(customPicklistField.annotations.referenceTo).toBeDefined()

      // Should omit only referenceTo from Picklist Fields with a StandardValueSet
      const standardValueSetField = testObject.fields[STANDARD_VALUE_SET_FIELD]
      expect(standardValueSetField).toBeDefined()
      expect(standardValueSetField.annotations.valueSetName).toBeDefined()
      expect(standardValueSetField.annotations.referenceTo).toBeUndefined()
    })
  })
})
