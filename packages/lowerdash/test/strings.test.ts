/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { describe } from 'jest-circus'
import { strings } from '../src'

describe('strings', () => {
  describe('insecureRandomString', () => {
    describe('when given no arguments', () => {
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

  describe('stableCollator', () => {
    const { stableCollator } = strings
    describe('when used to sort', () => {
      it('should sort', () => {
        expect(['b', 'a'].sort(stableCollator.compare)).toEqual(['a', 'b'])
      })
    })
  })

  describe('detachStrings', () => {
    const { detachStrings } = strings

    class MyClass { x = 100 }

    const el1 = { a: 12, aString: '13', cycle: undefined as unknown, isUndefined: undefined }
    const el2 = { foo: { anotherString: '14', f: (x: number): number => x * 2 }, myInstance: new MyClass() }
    const r = [el1, el2]
    el1.cycle = r

    it('does not change input', () => {
      expect(detachStrings(r)).toEqual(r)
      expect(el1).toHaveProperty('isUndefined', undefined)
      expect(el2.foo.f(3)).toEqual(6)
      expect(el2.myInstance).toBeInstanceOf(MyClass)
      expect(el2.myInstance.x).toEqual(100)
    })
  })
})
