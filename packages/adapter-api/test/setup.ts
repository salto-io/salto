/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import type { Tester } from '@jest/expect-utils'
import { expect } from '@jest/globals'
import { ElemID } from '../src/element_id'

// We cannot import this from @salto-io/adapter-api-test-utils because it would cause a cyclic dependency
// so we have to define this here separately
export const isEqualElemID: Tester = function isEqualElemID(a, b) {
  if (a instanceof ElemID && b instanceof ElemID) {
    return a.isEqual(b)
  }
  return undefined
}

expect.addEqualityTesters([isEqualElemID])
