/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { TesterContext } from '@jest/expect-utils'
import { ElemID } from '@salto-io/adapter-api'
import { isEqualElemID as isEqualElemIDUnbound } from '../src/custom_equality'

describe('isEqualElemID', () => {
  let mockTesterContext: TesterContext
  let isEqualElemID: OmitThisParameter<typeof isEqualElemIDUnbound>
  beforeEach(() => {
    mockTesterContext = { equals: () => false }
    isEqualElemID = isEqualElemIDUnbound.bind(mockTesterContext)
  })
  describe('when called with element IDs', () => {
    describe('when IDs are equal', () => {
      it('should return true', () => {
        expect(isEqualElemID(new ElemID('dummy', 'test'), new ElemID('dummy', 'test'), [])).toBe(true)
      })
    })
    describe('when IDs are different', () => {
      it('should return false', () => {
        expect(isEqualElemID(new ElemID('dummy', 'test'), new ElemID('dummy', 'test2'), [])).toBe(false)
      })
    })
  })
  describe('when called with a value that is not an ElemID', () => {
    it('should return undefined', () => {
      expect(isEqualElemID(1, 2, [])).toBeUndefined()
    })
  })
})
