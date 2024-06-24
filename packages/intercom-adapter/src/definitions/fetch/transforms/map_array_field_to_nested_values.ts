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
import { Value } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { validateItemValue } from './validators'

type FieldAdjustment = {
  fieldName: string
  nestedField: string
  fromField?: string
  fallbackValue: Value
}

/**
 * Transform fields that contain array of objects to fields that contain array of values,
 * where each value is a field of the object.
 * Example:
 * mapArrayFieldToNestedValues([{ fieldName: 'field1', fromField: 'inner', nestedField: 'nestedField1', fallbackValue: 'fallback1' ])
 * will transform { field1: { inner: [{ nestedField1: 'value1' }, 'value2'] } } to { field1: ['value1', 'fallback1'] }
 */

export const mapArrayFieldToNestedValues =
  (fieldAdjustments: FieldAdjustment[]): definitions.AdjustFunction =>
  ({ value }) => {
    validateItemValue(value)
    const mapField = ({ fieldName, fromField, nestedField, fallbackValue }: FieldAdjustment): Value => {
      const fieldToMap = _.get(value, fromField ? `${fieldName}.${fromField}` : fieldName)
      if (fieldToMap === undefined) {
        return {}
      }

      if (!Array.isArray(fieldToMap)) {
        throw new Error(`Unexpected item value for mapNestedArrayToFields: ${fieldToMap}, expected array`)
      }

      const mappingFunction = (item: Value): Value => _.get(item, nestedField, fallbackValue)
      return {
        [fieldName]: fieldToMap.map(mappingFunction),
      }
    }

    return {
      value: {
        ...value,
        ...fieldAdjustments.reduce((acc, fieldAdjustment) => ({ ...acc, ...mapField(fieldAdjustment) }), {}),
      },
    }
  }
