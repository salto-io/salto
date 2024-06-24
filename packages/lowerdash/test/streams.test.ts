/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { streams } from '../src/index'

describe('streams', () => {
  describe('hasColors', () => {
    let stream: streams.MaybeTty

    describe('when a stream has no isTTY property', () => {
      beforeEach(() => {
        stream = {}
      })

      it('returns false', () => {
        expect(streams.hasColors(stream)).toBe(false)
      })
    })

    describe('when a stream is not TTY', () => {
      beforeEach(() => {
        stream = { isTTY: false }
      })

      it('returns false', () => {
        expect(streams.hasColors(stream)).toBe(false)
      })
    })

    describe('when a stream is TTY', () => {
      beforeEach(() => {
        stream = { isTTY: true }
      })

      describe('and has no getColorDepth func', () => {
        it('returns false', () => {
          expect(streams.hasColors(stream)).toBe(false)
        })
      })

      describe('and has a getColorDepth func', () => {
        describe('which returns 1', () => {
          beforeEach(() => {
            stream.getColorDepth = () => 1
          })

          it('returns false', () => {
            expect(streams.hasColors(stream)).toBe(false)
          })
        })

        describe('which returns greater than 1', () => {
          beforeEach(() => {
            stream.getColorDepth = () => 2
          })

          it('returns true', () => {
            expect(streams.hasColors(stream)).toBe(true)
          })
        })
      })
    })
  })
})
