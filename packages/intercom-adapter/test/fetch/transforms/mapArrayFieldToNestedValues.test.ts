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

import { mapArrayFieldToNestedValues } from '../../../src/definitions/fetch/transforms'

describe('mapArrayFieldToNestedValues', () => {
  const generatedItem = {
    typeName: 'generatedItem',
    value: {},
    context: {},
  }

  describe('When the value is not an object', () => {
    it('Should throw an error', () => {
      const fieldAdjustments = [{ fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }]
      expect(() => mapArrayFieldToNestedValues(fieldAdjustments)({ ...generatedItem, value: 'item1' })).toThrow(
        'Unexpected item value: "item1", expected object',
      )
    })
  })

  describe('When the field does not exist in the object', () => {
    it('Should return the object as is', () => {
      const fieldAdjustments = [{ fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }]
      const result = mapArrayFieldToNestedValues(fieldAdjustments)(generatedItem)
      expect(result.value).toEqual({})
    })
  })

  describe('When the field exists in the object', () => {
    describe('When the field is an array', () => {
      it('Should return the object with the field mapped to the nested field', () => {
        const fieldAdjustments = [{ fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }]
        const value = { field1: [{ nestedField1: 'value1' }, 'value2'] }
        const result = mapArrayFieldToNestedValues(fieldAdjustments)({ ...generatedItem, value })
        expect(result.value).toEqual({ field1: ['value1', 'fallback1'] })
      })
    })

    describe('When the field is not an array', () => {
      it('Should throw an error', () => {
        const fieldAdjustments = [{ fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' }]
        const item = { field1: 'item1' }
        expect(() => mapArrayFieldToNestedValues(fieldAdjustments)({ ...generatedItem, value: item })).toThrow(
          'Unexpected item value for mapNestedArrayToFields: item1, expected array',
        )
      })
    })
  })

  describe('When fromField is specified', () => {
    it('Should return the object with the field mapped to the nested field', () => {
      const fieldAdjustments = [
        { fieldName: 'field1', fromField: 'inner', nestedField: 'nestedField1', fallbackValue: 'fallback1' },
      ]
      const value = { field1: { inner: [{ nestedField1: 'value1' }, 'value2'] } }
      const result = mapArrayFieldToNestedValues(fieldAdjustments)({ ...generatedItem, value })
      expect(result.value).toEqual({ field1: ['value1', 'fallback1'] })
    })
  })

  describe('When there are multiple field adjustments', () => {
    it('Should return the object with all the fields mapped to the nested fields', () => {
      const fieldAdjustments = [
        { fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' },
        { fieldName: 'field2', nestedField: 'nestedField2', fallbackValue: 'fallback2' },
      ]
      const value = {
        field1: [{ nestedField1: 'value1' }, 'value2'],
        field2: [{ nestedField2: 'value3' }, 'value4'],
      }
      const result = mapArrayFieldToNestedValues(fieldAdjustments)({ ...generatedItem, value })
      expect(result.value).toEqual({
        field1: ['value1', 'fallback1'],
        field2: ['value3', 'fallback2'],
      })
    })
  })
})
