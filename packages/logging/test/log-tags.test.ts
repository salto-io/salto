/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { formatPrimitiveLogTagValue, formatTextFormatLogTags } from '../src/log-tags'

describe('logTags', () => {
  // The rest of the coverage is covered in pino_logger.test.ts
  describe('formatPrimitiveLogTagValue', () => {
    it('should return string from number', () => {
      expect(formatPrimitiveLogTagValue(5)).toEqual('5')
    })
    it('should return string from boolean', () => {
      expect(formatPrimitiveLogTagValue(true)).toEqual('true')
    })
    it('should return string from string', () => {
      expect(formatPrimitiveLogTagValue('foo')).toEqual('"foo"')
    })
    it('should return empty from undefined', () => {
      expect(formatPrimitiveLogTagValue(undefined)).toEqual('')
    })
    it('should return stringified from string', () => {
      expect(formatPrimitiveLogTagValue('"foo')).toEqual(JSON.stringify('"foo'))
    })
  })
  describe('formatLogTags', () => {
    it('should return empty string for function value', () => {
      expect(formatTextFormatLogTags({ some: undefined }, [])).toEqual('')
    })
    it('should print error stack-trace and message', () => {
      const tagValue = formatTextFormatLogTags({ error: new Error('something bad') }, [])
      expect(tagValue).toContain('stack')
      expect(tagValue).toContain('.ts')
      expect(tagValue).toContain('something bad')
    })
  })
})
