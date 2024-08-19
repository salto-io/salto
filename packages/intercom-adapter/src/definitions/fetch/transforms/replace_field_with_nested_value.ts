/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  }): definitions.AdjustFunctionSingle =>
  async ({ value }) => {
    validateItemValue(value)

    return {
      value: {
        ...value,
        [fieldName]: _.get(value, `${fieldName}.${nestedField}`, fallbackValue),
      },
    }
  }
