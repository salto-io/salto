/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  capitalizeFirstLetter,
  continuousSplit,
  humanFileSize,
  insecureRandomString,
  isNumberStr,
  lowerCaseFirstLetter,
  matchAll,
} from '../src/strings'

describe('strings', () => {
  describe('insecureRandomString', () => {
    describe('when given no parameters', () => {
      let s: string
      beforeEach(() => {
        s = insecureRandomString()
      })

      it('generates a string of length 10', () => {
        expect(s).toHaveLength(10)
      })

      it('generates a string from the default alphabet', () => {
        expect(s).toMatch(/[A-Za-z0-9]{10}/)
      })

      describe('when called again', () => {
        let s2: string
        beforeEach(() => {
          s2 = insecureRandomString()
        })

        it('hopefully generates a different string', () => {
          expect(s2).not.toEqual(s)
        })
      })
    })

    describe('when given a length argument', () => {
      let s: string
      beforeEach(() => {
        s = insecureRandomString({ length: 12 })
      })

      it('generates a string of the specified length', () => {
        expect(s).toHaveLength(12)
      })
    })

    describe('when given an alphabet argument', () => {
      let s: string
      beforeEach(() => {
        s = insecureRandomString({ alphabet: 'abc' })
      })

      it('generates a string from the given alphabet', () => {
        expect(s).toMatch(/[abc]{10}/)
      })
    })
  })

  describe('capitalizeFirstLetter', () => {
    it('should capitalize first letter when lowercase', () => {
      expect(capitalizeFirstLetter('abcdef')).toEqual('Abcdef')
      expect(capitalizeFirstLetter('abcDef')).toEqual('AbcDef')
      expect(capitalizeFirstLetter('aBcDef')).toEqual('ABcDef')
      expect(capitalizeFirstLetter('abc def')).toEqual('Abc def')
    })
    it('should not modify string when already capitalized', () => {
      expect(capitalizeFirstLetter('Abcdef')).toEqual('Abcdef')
      expect(capitalizeFirstLetter('ABC')).toEqual('ABC')
    })
    it('should not modify characters that are not letters', () => {
      expect(capitalizeFirstLetter('123abc')).toEqual('123abc')
      expect(capitalizeFirstLetter('!?')).toEqual('!?')
    })
    it('should handle short and empty strings', () => {
      expect(capitalizeFirstLetter('a')).toEqual('A')
      expect(capitalizeFirstLetter('A')).toEqual('A')
      expect(capitalizeFirstLetter('')).toEqual('')
    })
  })

  it('lowerCaseFirstLetter', () => {
    expect(lowerCaseFirstLetter('Abcdef')).toEqual('abcdef')
    expect(lowerCaseFirstLetter('abcDef')).toEqual('abcDef')
    expect(lowerCaseFirstLetter('ABcDef')).toEqual('aBcDef')
    expect(lowerCaseFirstLetter('Abc def')).toEqual('abc def')
  })

  describe('matchAll', () => {
    it('should find all matches for a global regular expression', () => {
      const unnamed = [...matchAll('abcdacdbcd', /[ab](cd)/g)]
      expect(unnamed).toHaveLength(3)
      expect(unnamed[0][0]).toEqual('bcd')
      expect(unnamed[0][1]).toEqual('cd')
      expect(unnamed[0].groups).toBeUndefined()
      expect(unnamed[1][0]).toEqual('acd')
      expect(unnamed[1][1]).toEqual('cd')
      const named = [...matchAll('abcdacdbcd', /[ab](?<g1>cd)/g)]
      expect(named).toHaveLength(3)
      expect(named[0][0]).toEqual('bcd')
      expect(named[0][1]).toEqual('cd')
      expect(named[0].groups).toEqual({ g1: 'cd' })
      expect(named[1][0]).toEqual('acd')
      expect(named[1][1]).toEqual('cd')
    })
    it('should return empty when no matches were found', () => {
      expect([...matchAll('abcdbcdbcd', /[ab](cde)/g)]).toEqual([])
    })
    it('should throw for non-global regular expressions', () => {
      expect(() => [...matchAll('abcdacdbcd', /[ab](cd)/)]).toThrow(
        new Error('matchAll only supports global regular expressions'),
      )
    })
  })

  describe('continuous split', () => {
    const FIND_A = new RegExp('a', 'g')
    const FIND_B = new RegExp('b', 'g')

    it('should return empty array for empty string', () => {
      expect(continuousSplit('', [FIND_A, FIND_B])).toEqual([])
    })
    it('should return one length array for empty search', () => {
      expect(continuousSplit('hello world', [])).toEqual(['hello world'])
    })
    it('should split string by all regexes', () => {
      expect(continuousSplit('afirstasecondbthirdafourthb', [FIND_A, FIND_B])).toEqual([
        'first',
        'second',
        'third',
        'fourth',
      ])
    })
  })

  describe('humanFileSize', () => {
    it('should return result in bytes', () => {
      expect(humanFileSize(500)).toEqual('500.00 B')
    })
    it('should return result in KB', () => {
      expect(humanFileSize(50000)).toEqual('48.83 kB')
    })
    it('should return result in MB', () => {
      expect(humanFileSize(50000000)).toEqual('47.68 MB')
    })
    it('should return result in GB', () => {
      expect(humanFileSize(50000000000)).toEqual('46.57 GB')
    })
    it('should return result in TB', () => {
      expect(humanFileSize(50000000000000)).toEqual('45.47 TB')
    })
  })

  describe('isNumberStr', () => {
    it('should return true on string of number', () => {
      expect(isNumberStr('500')).toBeTruthy()
    })
    it('should return false on a string of nan', () => {
      expect(isNumberStr('adc')).toBeFalsy()
    })
    it('should return true on a string of decimal number', () => {
      expect(isNumberStr('0.95')).toBeTruthy()
    })
    it('should return false on an empty string', () => {
      expect(isNumberStr('')).toBeFalsy()
    })
  })
})
