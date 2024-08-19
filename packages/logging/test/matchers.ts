/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const toContainColors: (received?: unknown) => { message(): string; pass: boolean } = received =>
  typeof received === 'string' && received.includes('\u001b[')
    ? { pass: true, message: () => `expected "${received}" not to contain colors` }
    : { pass: false, message: () => `expected "${received} to contain colors` }

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R, T> {
    toContainColors: typeof toContainColors
  }
}

expect.extend({ toContainColors })
