import {
  AtLeastOne, RequiredMember, hasMember, filterHasMember,
} from '../src/types'

// Note: some of the tests here are compile-time, so the actual assertions may look weird.

describe('types', () => {
  type TestType = AtLeastOne<{
    first: number
    second: number
  }>

  describe('RequiredMember', () => {
    type TestTypeRequiresFirst = RequiredMember<TestType, 'first'>
    const t: TestTypeRequiresFirst = { first: 21 }

    it('should return a required member', () => {
      expect(t.first).toBe(21)
    })

    // commented out - should produce compilation error
    // const tWithSecond: TestTypeRequiresFirst = { second: 13 }
  })

  const tWithFirst: TestType = { first: 12 }
  const tWithSecond: TestType = { second: 13 }

  // commented out - should produce compilation error
  // const tEmpty: TestType = {}

  describe('hasMember', () => {
    describe('when the member exists', () => {
      it('returns the HasMember type', () => {
        expect(hasMember('first', tWithFirst)).toBeTruthy()
        if (hasMember('first', tWithFirst)) {
          expect(tWithFirst.first).toBe(12)
        }
      })
    })

    describe('when the member does not exist', () => {
      it('does not return the HasMember type', () => {
        expect(hasMember('second', tWithFirst)).toBeFalsy()
      })
    })
  })

  describe('filterHasMember', () => {
    const list: TestType[] = [tWithFirst, tWithSecond, tWithFirst]

    it('should return only items which have the specified member', () => {
      expect(filterHasMember('first', list)).toEqual([tWithFirst, tWithFirst])
    })

    it('should cast output items to HasMember', () => {
      expect(filterHasMember('first', list).map(i => i.first)).toEqual([12, 12])
    })
  })
})
