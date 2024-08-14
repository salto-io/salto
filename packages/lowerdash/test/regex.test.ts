/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isFullRegexMatch, isValidRegex } from '../src/regex'

describe('regex', () => {
  describe('isValidRegex', () => {
    it('should return false for an invalid regex string', () => {
      expect(isValidRegex('\\')).toBeFalsy()
    })

    it('should return true for a valid regex', () => {
      expect(isValidRegex('validRegex')).toBeTruthy()
    })
  })

  describe('isFullRegexMatch', () => {
    it('should return false if not full match', () => {
      expect(isFullRegexMatch('ab', 'b.*')).toBeFalsy()
    })

    it('should return true if full match', () => {
      expect(isFullRegexMatch('ab', 'ab.*')).toBeTruthy()
    })
  })
})
