/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { cleanEmptyObjects, concatObjects } from '../src/objects'

describe('concatObjects', () => {
  type testType = {
    a: string[] | undefined
    b: string[] | undefined
    c: { name: string }[] | undefined
  }
  const objects: testType[] = [
    {
      a: ['a', 'b'],
      b: ['1', '2'],
      c: undefined,
    },
    {
      a: ['c', 'd'],
      b: undefined,
      c: [{ name: 'name1' }, { name: 'name2' }],
    },
    {
      a: undefined,
      b: ['3', '4'],
      c: [{ name: 'name1' }, { name: 'name4' }],
    },
  ]

  describe('when uniqueFnByKey is not provided', () => {
    it('Should return an object with duplicate array values concatenated', () => {
      expect(concatObjects(objects)).toEqual({
        a: ['a', 'b', 'c', 'd'],
        b: ['1', '2', '3', '4'],
        c: [{ name: 'name1' }, { name: 'name2' }, { name: 'name1' }, { name: 'name4' }],
      })
    })
  })
  describe('when uniqueFnByKey is provided', () => {
    it('Should return an object with unique array values concatenated', () => {
      expect(concatObjects(objects, { c: values => _.uniqBy(values, 'name') })).toEqual({
        a: ['a', 'b', 'c', 'd'],
        b: ['1', '2', '3', '4'],
        c: [{ name: 'name1' }, { name: 'name2' }, { name: 'name4' }],
      })
    })
  })
})

describe('cleanEmptyObjects', () => {
  it('should not return undefined for empty arrays', () => {
    expect(cleanEmptyObjects({ a: [] })).toEqual({ a: [] })
  })
  it('should return undefined for empty object', () => {
    const obj = { a: {} }
    expect(cleanEmptyObjects(obj)).toBeUndefined()
  })
  it('should remove object parts', () => {
    const obj = {
      a: 'a',
      b: {},
      c: {
        d: 'd',
        e: {
          f: {},
          g: { h: undefined },
        },
      },
    }
    expect(cleanEmptyObjects(obj)).toEqual({
      a: 'a',
      c: {
        d: 'd',
      },
    })
  })
  it('should not clean arrays or objects inside arrays', () => {
    const obj = {
      a: 'a',
      b: {
        c: {},
        arr: [],
      },
      anotherArr: [{}, { a: 'b' }],
    }
    expect(cleanEmptyObjects(obj)).toEqual({
      a: 'a',
      b: {
        arr: [],
      },
      anotherArr: [{}, { a: 'b' }],
    })
  })
})
