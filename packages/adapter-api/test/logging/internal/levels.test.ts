import { LOG_LEVELS } from '../../../src/logging/internal/common'
import { pad, toHexColor } from '../../../src/logging/internal/levels'

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
})
