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
import {
  AtLeastOne, RequiredMember, hasMember, filterHasMember, ValueOf,
  Bean,
} from '../src/types'

// Note: some of the tests here are compile-time, so the actual assertions may look weird.

describe('types', () => {
  describe('ValueOf', () => {
    class A { constructor(public val: string) { } }
    class B { constructor(public val: number) { } }
    const map = {
      a: A,
      b: B,
    }
    type InstanceOfValueOfMap = InstanceType<ValueOf<typeof map>>

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function isValueOfMap(_obj: any): _obj is InstanceOfValueOfMap {
      // Make sure the code will transpile, the return value of the type-guard should not matter
      return false
    }

    it('should transpile', () => {
      const c = new A('def') as unknown
      const res = isValueOfMap(c) ? c.val : 'no'
      expect(res).toEqual('no')
    })
  })
  describe('AtLeastOne, RequiredMember', () => {
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

  describe('Beans', () => {
    type MyProps = { p1: string; p2: number }
    class MyBean extends Bean<MyProps> {}

    describe('constructor', () => {
      const m = new MyBean({ p1: 'astring', p2: 12 })
      expect(m.p1).toBe('astring')
      expect(m.p2).toBe(12)
    })
  })
})
