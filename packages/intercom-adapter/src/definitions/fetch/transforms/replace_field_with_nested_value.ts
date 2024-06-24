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

/**
 * Replace a field with a nested value from the item.
 * If the nested field does not exist, the fallback value will be used.
 * Example:
 * replaceFieldWithNestedValue({ fieldName: 'field1', nestedField: 'nestedField1', fallbackValue: 'fallback1' })
 * will transform { field1: { nestedField1: 'value1' } } to { field1: 'value1' }
 * and { field1: {} } to { field1: 'fallback1' }
 */
export const replaceFieldWithNestedValue =
  ({
    fieldName,
    nestedField,
    fallbackValue,
  }: {
    fieldName: string
    nestedField: string
    fallbackValue: Value
  }): definitions.AdjustFunction =>
  ({ value }) => {
    validateItemValue(value)

    return {
      value: {
        ...value,
        [fieldName]: _.get(value, `${fieldName}.${nestedField}`, fallbackValue),
      },
    }
  }
