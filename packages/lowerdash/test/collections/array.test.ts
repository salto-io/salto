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
import _ from 'lodash'
import { collections } from '../../src'

const { makeArray, arrayOf } = collections.array

describe('array', () => {
  describe('makeArray', () => {
    describe('when passed undefined', () => {
      it('returns an empty array', () => {
        expect(makeArray(undefined)).toEqual([])
      })
    })

    describe('when passed a non-array arg', () => {
      it('returns an array wrapping the arg', () => {
        expect(makeArray(12)).toEqual([12])
        const s = new Set<number>([13])
        expect(makeArray(s)).toEqual([s])
      })
    })

    describe('when passed an array', () => {
      it('returns the array', () => {
        const ar = [12, 13]
        expect(makeArray(ar)).toBe(ar)
      })
    })
  })

  describe('arrayOf', () => {
    const ARRAY_LENGTH = 5

    describe('when an initializer is specified', () => {
      let result: string[]
      beforeEach(() => {
        result = arrayOf(ARRAY_LENGTH, i => i.toString())
      })

      it('returns an array', () => {
        expect(_.isArray(result)).toBeTruthy()
      })

      it('returns an array of the specified length', () => {
        expect(result).toHaveLength(5)
      })

      it('returns an array with the correct items', () => {
        expect(result).toEqual(['0', '1', '2', '3', '4'])
      })
    })

    describe('when an initializer is not specified', () => {
      let result: undefined[]
      beforeEach(() => {
        result = arrayOf(ARRAY_LENGTH)
      })

      it('returns an array', () => {
        expect(_.isArray(result)).toBeTruthy()
      })

      it('returns an array of the specified length', () => {
        expect(result).toHaveLength(5)
      })

      it('returns an array whose all items are undefined', () => {
        expect(result).toEqual([undefined, undefined, undefined, undefined, undefined])
      })
    })
  })
})
