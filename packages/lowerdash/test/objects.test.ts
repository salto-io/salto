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
import { cleanEmptyObjects, concatObjects } from '../src/objects'

describe('concatObjects', () => {
  type testType = {
    a: string[] | undefined
    b: string[] | undefined
  }
  const objects: testType[] = [
    {
      a: ['a', 'b'],
      b: ['1', '2'],
    },
    {
      a: ['c', 'd'],
      b: undefined,
    },
    {
      a: undefined,
      b: ['3', '4'],
    },
  ]

  it('Should return an object with array values concatenated', () => {
    expect(concatObjects(objects)).toEqual({
      a: ['a', 'b', 'c', 'd'],
      b: ['1', '2', '3', '4'],
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
