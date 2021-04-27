/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { strings } from '../src/index'

describe('strings', () => {
  describe('insecureRandomString', () => {
    describe('when given no paramters', () => {
      let s: string
      beforeEach(() => {
        s = strings.insecureRandomString()
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
          s2 = strings.insecureRandomString()
        })

        it('hopefully generates a different string', () => {
          expect(s2).not.toEqual(s)
        })
      })
    })

    describe('when given a length argument', () => {
      let s: string
      beforeEach(() => {
        s = strings.insecureRandomString({ length: 12 })
      })

      it('generates a string of the specified length', () => {
        expect(s).toHaveLength(12)
      })
    })

    describe('when given an alphabet argument', () => {
      let s: string
      beforeEach(() => {
        s = strings.insecureRandomString({ alphabet: 'abc' })
      })

      it('generates a string from the given alphabet', () => {
        expect(s).toMatch(/[abc]{10}/)
      })
    })
  })

  describe('capitalizeFirstLetter', () => {
    it('should capitalize first letter when lowercase', () => {
      expect(strings.capitalizeFirstLetter('abcdef')).toEqual('Abcdef')
      expect(strings.capitalizeFirstLetter('abcDef')).toEqual('AbcDef')
      expect(strings.capitalizeFirstLetter('aBcDef')).toEqual('ABcDef')
      expect(strings.capitalizeFirstLetter('abc def')).toEqual('Abc def')
    })
    it('should not modify string when already capitalized', () => {
      expect(strings.capitalizeFirstLetter('Abcdef')).toEqual('Abcdef')
      expect(strings.capitalizeFirstLetter('ABC')).toEqual('ABC')
    })
    it('should not modify characters that are not letters', () => {
      expect(strings.capitalizeFirstLetter('123abc')).toEqual('123abc')
      expect(strings.capitalizeFirstLetter('!?')).toEqual('!?')
    })
    it('should handle short and empty strings', () => {
      expect(strings.capitalizeFirstLetter('a')).toEqual('A')
      expect(strings.capitalizeFirstLetter('A')).toEqual('A')
      expect(strings.capitalizeFirstLetter('')).toEqual('')
    })
  })

  describe('matchAll', () => {
    it('should find all matches for a global regular expression', () => {
      const unnamed = [...strings.matchAll('abcdacdbcd', /[ab](cd)/g)]
      expect(unnamed).toHaveLength(3)
      expect(unnamed[0][0]).toEqual('bcd')
      expect(unnamed[0][1]).toEqual('cd')
      expect(unnamed[0].groups).toBeUndefined()
      expect(unnamed[1][0]).toEqual('acd')
      expect(unnamed[1][1]).toEqual('cd')
      const named = [...strings.matchAll('abcdacdbcd', /[ab](?<g1>cd)/g)]
      expect(named).toHaveLength(3)
      expect(named[0][0]).toEqual('bcd')
      expect(named[0][1]).toEqual('cd')
      expect(named[0].groups).toEqual({ g1: 'cd' })
      expect(named[1][0]).toEqual('acd')
      expect(named[1][1]).toEqual('cd')
    })
    it('should return empty when no matches were found', () => {
      expect([...strings.matchAll('abcdbcdbcd', /[ab](cde)/g)]).toEqual([])
    })
    it('should throw for non-global regular expressions', () => {
      expect(() => [...strings.matchAll('abcdacdbcd', /[ab](cd)/)]).toThrow(new Error('matchAll only supports global regular expressions'))
    })
  })
})
