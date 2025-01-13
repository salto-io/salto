/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateValue } from '../../../src/definitions/utils'

describe('generic definitions utils', () => {
  describe('validateValue', () => {
    it('should return the value if it is an object', () => {
      const value = { key: 'value' }
      expect(validateValue(value)).toEqual(value)
    })

    it('should throw an error if the value is not an object', () => {
      expect(() => validateValue('not an object')).toThrow()
    })
  })
})
