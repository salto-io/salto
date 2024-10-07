/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'

// TODO improve example in SALTO-5428
export const transform: definitions.AdjustFunctionSingle = async ({ value }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for business hour schedule holiday, not transforming')
  }
  const holiday = value as {
    start_date?: string
    end_date?: string
  }
  const startYear = holiday.start_date?.split('-')[0]
  const endYear = holiday.end_date?.split('-')[0]
  return {
    value: {
      ...value,
      start_year: startYear,
      end_year: endYear,
    },
  }
}
