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
import { SetId } from '../../src/collections/set'
import { groupBy, toIndexedIterable, IndexedIterable, IndexedIterator } from '../../src/collections/iterable'
import { RequiredMember } from '../../src/types'

describe('iterable', () => {
  describe('groupBy', () => {
    let grouped: Map<SetId, number[]>
    beforeEach(() => {
      grouped = groupBy([1, 2, 3], num => num % 2)
    })
    it('should group elements according to the key function', () => {
      expect(grouped.get(0)).toEqual([2])
      expect(grouped.get(1)).toEqual([1, 3])
    })
  })

  describe('toIndexedIterable', () => {
    describe('when given an array', () => {
      let result: IndexedIterable<number>
      beforeEach(() => {
        result = toIndexedIterable([12, 13, 14])
      })

      it('transforms the iterable correctly', () => {
        expect([...result]).toEqual([
          [0, 12],
          [1, 13],
          [2, 14],
        ])
      })
    })
  })

  describe('when given an iterable with `returns` and `throws`', () => {
    let result: IndexedIterable<number>
    let resultIterator: RequiredMember<IndexedIterator<number>, 'return' | 'throw'>
    const input: Iterable<number> = {
      [Symbol.iterator]() {
        const i = [12, 13, 14][Symbol.iterator]()
        return {
          v: 'yo',
          next: i.next.bind(i),
          return(value) {
            return { done: true, value: `${this.v} ${value}` }
          },
          throw(e) {
            throw new Error(`testing: ${this.v} ${e.message}`)
          },
        } as Iterator<number> & { v: string }
      },
    }

    beforeEach(() => {
      result = toIndexedIterable(input)
      resultIterator = result[Symbol.iterator]() as typeof resultIterator
    })

    it('transforms the iterable correctly', () => {
      expect([...result]).toEqual([
        [0, 12],
        [1, 13],
        [2, 14],
      ])
    })

    it('defines `return` correctly', () => {
      expect(resultIterator.return).toBeDefined()
      expect(resultIterator.return(42)).toEqual({ done: true, value: 'yo 42' })
    })

    it('defines `throw` correctly', () => {
      expect(resultIterator.return).toBeDefined()
      expect(() => resultIterator.throw(new Error('hello'))).toThrow(/testing: yo hello/)
    })
  })
})
