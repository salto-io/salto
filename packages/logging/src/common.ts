/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export class ValidationError extends Error {}

export const validateOneOf = <V, T extends V>(list: ReadonlyArray<T>, typeName: string, v: V): T => {
  if (!list.includes(v as T)) {
    throw new ValidationError(`Invalid ${typeName} "${v}", expected one of: ${list}`)
  }
  return v as T
}
