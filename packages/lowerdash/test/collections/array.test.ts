import { collections } from '../../src'

const { makeArray } = collections.array

describe('array', () => {
  describe('makeArray', () => {
    describe('when passed undefined', () => {
      it('returns an empty array', () => {
        expect(makeArray(undefined)).toEqual([])
      })
    })

    describe('when passed a non-array arg', () => {
      it('returns an array wrapping the arg', () => {
        expect(makeArray(12)).toEqual([12])
        const s = new Set<number>([13])
        expect(makeArray(s)).toEqual([s])
      })
    })

    describe('when passed an array', () => {
      it('returns the array', () => {
        const ar = [12, 13]
        expect(makeArray(ar)).toBe(ar)
      })
    })
  })
})
