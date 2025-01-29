/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { mockFunction } from '../src/mock'

describe('mockFunction', () => {
  it('should create a jest mock function with proper type', () => {
    const func = mockFunction<(arg: number) => string>()
    // Note the mock implementation should enforce types here
    func.mockImplementation(num => num.toString())
    expect(jest.isMockFunction(func)).toBeTruthy()
  })
})
