/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, Values, isEqualValues } from '@salto-io/adapter-api'
import { inspectValue } from '@salto-io/adapter-utils'

expect.extend({
  toHaveEqualValues(received: Values, expected: InstanceElement) {
    const pass = isEqualValues(received, expected.value)
    return {
      pass,
      message: () =>
        `Received unexpected result when fetching instance: ${expected.elemID.getFullName()}.\n` +
        `Expected value: ${inspectValue(expected.value, { depth: 7 })},\n` +
        `Received value: ${inspectValue(received, { depth: 7 })}`,
    }
  },
})

expect.extend({
  toBeDefinedWithElemID(received: InstanceElement | undefined, expectedElemID: ElemID) {
    const passUndefined = received !== undefined
    const passElemID = received?.elemID.isEqual(expectedElemID)
    const pass = Boolean(passUndefined && passElemID)
    return {
      pass,
      message: () =>
        `Received ${!passUndefined ? 'undefined' : 'unexpected'} instance. Expected instance with elemID: ${expectedElemID.getFullName()}`,
    }
  },
})

interface CustomMatchers<R = unknown> {
  toHaveEqualValues(instance: InstanceElement): R
  toBeDefinedWithElemID(elemID: ElemID): R
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}
