/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export type MockInterface<T extends {}> = {
  [k in keyof T]: T[k] extends (...args: never[]) => unknown
    ? jest.MockedFunction<T[k]>
    : T[k] extends {}
      ? MockInterface<T[k]>
      : never
}

export const mockFunction = <T extends (...args: never[]) => unknown>(): jest.MockedFunction<T> =>
  jest.fn() as unknown as jest.MockedFunction<T>
