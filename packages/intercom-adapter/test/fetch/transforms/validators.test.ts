/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateItemValue } from '../../../src/definitions/fetch/transforms/validators'

describe('validateItemValue', () => {
  it('should throw an error when the value is not an object', () => {
    expect(() => validateItemValue([])).toThrow('Unexpected item value: [], expected object')
  })

  it('should throw an error when the value is undefined', () => {
    expect(() => validateItemValue(undefined)).toThrow('Unexpected item value: undefined, expected object')
  })

  it('should throw an error when the value is null', () => {
    expect(() => validateItemValue(null)).toThrow('Unexpected item value: null, expected object')
  })

  it('should not throw an error when the value is an object', () => {
    expect(() => validateItemValue({})).not.toThrow()
  })
})
