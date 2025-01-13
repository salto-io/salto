/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { values as lowerdashValues } from '@salto-io/lowerdash'

export const validateValue = (value: unknown): Record<string, unknown> => {
  if (!lowerdashValues.isPlainRecord(value)) {
    throw new Error('Can not adjust when the value is not an object')
  }
  return value
}
