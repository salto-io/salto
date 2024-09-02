/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { replaceFieldWithNestedValue } from '../../../src/definitions/fetch/transforms'

describe('replaceFieldWithNestedValue', () => {
  const generatedItem = {
    typeName: 'generatedItem',
    value: {},
    context: {},
  }

  describe('When the value is not an object', () => {
    it('Should throw an error', async () => {
      const fieldAdjustment = { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }
      await expect(async () =>
        replaceFieldWithNestedValue(fieldAdjustment)({ ...generatedItem, value: 'item1' }),
      ).rejects.toThrow('Unexpected item value: "item1", expected object')
    })
  })

  describe('When the field does not exist in the object', () => {
    it('Should return the object with the fallback value', async () => {
      const fieldAdjustment = { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }
      const result = await replaceFieldWithNestedValue(fieldAdjustment)(generatedItem)
      expect(result.value).toEqual({ field1: 'fallback1' })
    })
  })

  describe('When the field exists in the object', () => {
    it('Should return the object with the field replaced with the nested field', async () => {
      const fieldAdjustment = { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }
      const value = { field1: { nestedField1: 'value1' } }
      const result = await replaceFieldWithNestedValue(fieldAdjustment)({ ...generatedItem, value })
      expect(result.value).toEqual({ field1: 'value1' })
    })
  })
})
