/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { evaluateFunction, MissingFunctionError } from '../../src/parser/functions'

describe('Functions', () => {
  describe('MissingFunctionError', () => {
    it('should show correct message and severity', () => {
      const missus = new MissingFunctionError('ZOMG')
      expect(missus.message).toEqual('Element has invalid NaCl content')
      expect(missus.severity).toEqual('Error')
      expect(missus.toString()).toEqual(missus.message)
    })
  })
  describe('Factory', () => {
    it('should fail if missing function with default parameters', async () => {
      expect(await evaluateFunction('ZOMG', ['arg', 'us'], {})).toEqual(new MissingFunctionError('ZOMG'))
    })
    it('should fail if missing function with explicit parameters', async () => {
      expect(await evaluateFunction('ZOMG', ['arg', 'us'], {})).toEqual(new MissingFunctionError('ZOMG'))
    })
  })
})
