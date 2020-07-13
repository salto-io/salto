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
import { isDefined, isPrimitive } from '../src/values'

describe('isDefined', () => {
  describe('with undefined value', () => {
    it('should return false', () => {
      expect(isDefined(undefined)).toBeFalsy()
    })
  })
  describe('with defined value', () => {
    it('should return true with number', () => {
      expect(isDefined(0)).toBeTruthy()
    })
    it('should return true with string', () => {
      expect(isDefined('')).toBeTruthy()
    })
    it('should return true with null', () => {
      expect(isDefined(null)).toBeTruthy()
    })
    it('should return true with boolean', () => {
      expect(isDefined(false)).toBeTruthy()
    })
    it('should return true with array', () => {
      expect(isDefined([])).toBeTruthy()
    })
    it('should return true with object', () => {
      expect(isDefined({})).toBeTruthy()
    })
  })
})

describe('isPrimitive', () => {
  test('returns true for undefined', () => {
    expect(isPrimitive(undefined)).toBe(true)
  })
  test('returns true for null', () => {
    expect(isPrimitive(null)).toBe(true)
  })
  test('returns true for a number', () => {
    expect(isPrimitive(12)).toBe(true)
  })
  test('returns true for NaN', () => {
    expect(isPrimitive(NaN)).toBe(true)
  })
  test('returns true for positive infinity', () => {
    expect(isPrimitive(Infinity)).toBe(true)
  })
  test('returns true for negative infinity', () => {
    expect(isPrimitive(-Infinity)).toBe(true)
  })
  test('returns true for an empty string', () => {
    expect(isPrimitive('')).toBe(true)
  })
  test('returns true for an non-empty string', () => {
    expect(isPrimitive('a')).toBe(true)
  })
  test('returns true for true', () => {
    expect(isPrimitive(true)).toBe(true)
  })
  test('returns true for false', () => {
    expect(isPrimitive(false)).toBe(true)
  })

  test('returns false for an array', () => {
    expect(isPrimitive([])).toBe(false)
  })
  test('returns false for an object', () => {
    expect(isPrimitive({})).toBe(false)
  })
  test('returns false for a function', () => {
    expect(isPrimitive(() => undefined)).toBe(false)
  })
  test('returns false for a class', () => {
    expect(isPrimitive(class Foo {})).toBe(false)
  })
  test('returns false for a class instance', () => {
    class Foo {}
    expect(isPrimitive(new Foo())).toBe(false)
  })
})
