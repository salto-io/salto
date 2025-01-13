/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const setupEnvVar = (
  name: string,
  valueOrFactory:
    | string
    | number
    | undefined
    | (() => string | number | undefined | Promise<string | number | undefined>) = undefined,
  setupType: 'each' | 'all' = 'each',
): void => {
  const [setupFunc, teardownFunc] = setupType === 'all' ? [beforeAll, afterAll] : [beforeEach, afterEach]

  let savedValue: string | undefined
  setupFunc(async () => {
    const value = typeof valueOrFactory === 'function' ? await valueOrFactory() : valueOrFactory

    savedValue = process.env[name]
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = String(value)
    }
  })

  teardownFunc(() => {
    if (savedValue === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = savedValue
    }
  })
}
