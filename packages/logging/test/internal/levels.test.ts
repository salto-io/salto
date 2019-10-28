import { LOG_LEVELS, LogLevel } from '../../src/internal/common'
import { pad, toHexColor, compare } from '../../src/internal/levels'

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
