/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { replaceFieldWithNestedValue } from '../../../src/definitions/fetch/transforms'

describe('replaceFieldWithNestedValue', () => {
  const generatedItem = {
    typeName: 'generatedItem',
    value: {},
    context: {},
  }

  describe('When the value is not an object', () => {
    it('Should throw an error', () => {
      const fieldAdjustment = { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }
      expect(() => replaceFieldWithNestedValue(fieldAdjustment)({ ...generatedItem, value: 'item1' })).toThrow(
        'Unexpected item value: "item1", expected object',
      )
    })
  })

  describe('When the field does not exist in the object', () => {
    it('Should return the object with the fallback value', () => {
      const fieldAdjustment = { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }
      const result = replaceFieldWithNestedValue(fieldAdjustment)(generatedItem)
      expect(result.value).toEqual({ field1: 'fallback1' })
    })
  })

  describe('When the field exists in the object', () => {
    it('Should return the object with the field replaced with the nested field', () => {
      const fieldAdjustment = { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }
      const value = { field1: { nestedField1: 'value1' } }
      const result = replaceFieldWithNestedValue(fieldAdjustment)({ ...generatedItem, value })
      expect(result.value).toEqual({ field1: 'value1' })
    })
  })
})
