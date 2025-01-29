/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { extractCallerFilename } from '../src/stack'

describe('stack', () => {
  describe('extractCallerFilename', () => {
    const partialFilename = 'lowerdash/test/stack.test.'

    describe('when called with an error with no stack', () => {
      const error = new Error()
      delete error.stack
      it('should return undefined', () => {
        expect(extractCallerFilename(error, partialFilename)).toBeUndefined()
      })
    })

    describe('when called with an error with an empty message', () => {
      it('should return the caller filename', () => {
        expect(extractCallerFilename(new Error(), partialFilename)).toMatch(/node_modules\/jest/)
      })
    })

    describe('when called with an error with a non-empty message', () => {
      it('should return the caller filename', () => {
        expect(extractCallerFilename(new Error('hello'), partialFilename)).toMatch(/node_modules\/jest/)
      })
    })

    describe('when the specified partialFilename is not in the stack', () => {
      it('should return the caller filename', () => {
        expect(extractCallerFilename(new Error('hello'), 'NOSUCHFILE')).toBeUndefined()
      })
    })
  })
})
