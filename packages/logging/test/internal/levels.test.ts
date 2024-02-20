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
import { pad, toHexColor, compare, LOG_LEVELS, LogLevel } from '../../src/internal/level'

describe('levels', () => {
  describe('pad', () => {
    it('should pad all the levels to the same length', () => {
      const lengths = new Set<number>(LOG_LEVELS.map(pad).map(s => s.length))
      expect(lengths.size).toBe(1)
    })
  })

  describe('toHexColor', () => {
    LOG_LEVELS.forEach(l => {
      it('should return the same color to each level on multiple invocations', () => {
        expect(toHexColor(l)).toEqual(toHexColor(l))
      })

      it('should return a hex color format', () => {
        expect(toHexColor(l)).toMatch(/#[0-9a-fA-F]{6}/)
      })
    })
  })

  describe('compare', () => {
    LOG_LEVELS.forEach((l: LogLevel, i: number) => {
      describe('when comparing equal levels', () => {
        it('should return zero', () => {
          expect(compare(l, l)).toEqual(0)
        })
      })
      LOG_LEVELS.slice(i + 1).forEach((l2: LogLevel) => {
        describe(`when comparing ${l} and ${l2}`, () => {
          it('should return greater than zero', () => {
            expect(compare(l, l2)).toBeGreaterThan(0)
          })
        })
      })
      LOG_LEVELS.slice(0, i).forEach((l2: LogLevel) => {
        describe(`when comparing ${l} and ${l2}`, () => {
          it('should return less than zero', () => {
            expect(compare(l, l2)).toBeLessThan(0)
          })
        })
      })
    })
  })
})
