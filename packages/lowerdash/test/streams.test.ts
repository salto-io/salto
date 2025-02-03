/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { hasColors, MaybeTty } from '../src/streams'

describe('streams', () => {
  describe('hasColors', () => {
    let stream: MaybeTty

    describe('when a stream has no isTTY property', () => {
      beforeEach(() => {
        stream = {}
      })

      it('returns false', () => {
        expect(hasColors(stream)).toBe(false)
      })
    })

    describe('when a stream is not TTY', () => {
      beforeEach(() => {
        stream = { isTTY: false }
      })

      it('returns false', () => {
        expect(hasColors(stream)).toBe(false)
      })
    })

    describe('when a stream is TTY', () => {
      beforeEach(() => {
        stream = { isTTY: true }
      })

      describe('and has no getColorDepth func', () => {
        it('returns false', () => {
          expect(hasColors(stream)).toBe(false)
        })
      })

      describe('and has a getColorDepth func', () => {
        describe('which returns 1', () => {
          beforeEach(() => {
            stream.getColorDepth = () => 1
          })

          it('returns false', () => {
            expect(hasColors(stream)).toBe(false)
          })
        })

        describe('which returns greater than 1', () => {
          beforeEach(() => {
            stream.getColorDepth = () => 2
          })

          it('returns true', () => {
            expect(hasColors(stream)).toBe(true)
          })
        })
      })
    })
  })
})
