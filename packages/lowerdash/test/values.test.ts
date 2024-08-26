/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isDefined, isPlainObject, isPlainRecord, lookupValue } from '../src/values'

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

describe('isPlainObject', () => {
  it('should return false for undefined', () => {
    expect(isPlainObject(undefined)).toBeFalsy()
  })
  it('should return true for object', () => {
    expect(isPlainObject({})).toBeTruthy()
    expect(isPlainObject({ a: 'a', b: ['c', 'd'] })).toBeTruthy()
  })
  it('should return false for array', () => {
    expect(isPlainObject([])).toBeFalsy()
    expect(isPlainObject([{ a: 'a', b: ['c', 'd'] }])).toBeFalsy()
  })
})

describe('isRecord', () => {
  it('should return false for undefined', () => {
    expect(isPlainRecord(undefined)).toBeFalsy()
  })
  it('should return true for object', () => {
    expect(isPlainRecord({})).toBeTruthy()
    expect(isPlainRecord({ a: 'a', b: ['c', 'd'] })).toBeTruthy()
  })
  it('should return false for array', () => {
    expect(isPlainRecord([])).toBeFalsy()
    expect(isPlainRecord([{ a: 'a', b: ['c', 'd'] }])).toBeFalsy()
  })
})

describe('lookupValue', () => {
  it('should return false', () => {
    expect(lookupValue({ a: 'a', b: ['c', 'd'] }, val => val === 'e')).toBeFalsy()
  })
  it('should return true', () => {
    expect(lookupValue({ a: 'a', b: ['c', 'd'] }, val => val === 'd')).toBeTruthy()
  })
})
