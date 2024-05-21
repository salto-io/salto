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
import _ from 'lodash'
import {
  AtLeastOne,
  RequiredMember,
  hasMember,
  filterHasMember,
  ValueOf,
  Bean,
  isArrayOfType,
  TypeGuard,
  isNonEmptyArray,
  isTypeOfOrUndefined,
} from '../src/types'

// Note: some of the tests here are compile-time, so the actual assertions may look weird.

describe('types', () => {
  describe('ValueOf', () => {
    class A {
      constructor(public val: string) {}
    }
    class B {
      constructor(public val: number) {}
    }
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

  describe('isArrayOfType', () => {
    type MyType = { a: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Guard = TypeGuard<unknown, MyType>

    it('should return true if the type guard returns true for all items', () => {
      const truthy: Guard = (_t: unknown): _t is MyType => true
      expect(isArrayOfType([{ a: 'b' }, { c: 'd' }], truthy)).toBeTruthy()
    })
    it('should return false if the type guard returns false for any item', () => {
      const falsy: Guard = (_t: unknown): _t is MyType => false
      expect(isArrayOfType([{ a: 'b' }, { c: 'd' }], falsy)).toBeFalsy()
      const actual: Guard = (t: unknown): t is MyType => _.isString(_.get(t, 'a'))
      expect(isArrayOfType([{ a: 'b' }, { c: 'd' }], actual)).toBeFalsy()
    })
    it('should return true if the array is empty', () => {
      const falsy: Guard = (_t: unknown): _t is MyType => false
      expect(isArrayOfType([], falsy)).toBeTruthy()
    })
  })
  describe('isNonEmptyArray', () => {
    it('should return true for non empty array', () => {
      expect(isNonEmptyArray([12])).toEqual(true)
    })
    it('should return false for empty array', () => {
      expect(isNonEmptyArray([])).toEqual(false)
    })
  })
  describe('isTypeOfOrUndefined', () => {
    it('should return true', () => {
      const test: unknown = [1, 2, 3]
      const res = isTypeOfOrUndefined(test, Array.isArray) ? test?.length : 0
      expect(res).toEqual(3)
    })
    it('should return false', () => {
      const test: unknown = '123'
      const res = isTypeOfOrUndefined(test, Array.isArray) ? test?.length : 0
      expect(res).toEqual(0)
    })
  })
})
