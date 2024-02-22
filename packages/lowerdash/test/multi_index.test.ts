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
import { mockFunction } from '@salto-io/test-utils'
import { buildMultiIndex, keyByAsync, Index } from '../src/multi_index'
import { toAsyncIterable } from '../src/collections/asynciterable'

describe('multi index', () => {
  let items: AsyncIterable<number>
  beforeEach(() => {
    items = toAsyncIterable([1, 2, 3, 4])
  })

  describe('keyByAsync', () => {
    let result: Index<[string, string], number>
    let mapFunc: jest.MockedFunction<(n: number) => number>
    beforeEach(async () => {
      mapFunc = mockFunction<typeof mapFunc>().mockImplementation(item => item + 1)
      result = await keyByAsync({
        iter: items,
        filter: item => item % 2 === 0,
        key: item => [item.toString(), (item + 1).toString()],
        map: mapFunc,
      })
    })
    it('should filter items according to filter func', () => {
      expect(mapFunc).not.toHaveBeenCalledWith(1)
      expect(mapFunc).toHaveBeenCalledWith(2)
      expect(mapFunc).not.toHaveBeenCalledWith(3)
      expect(mapFunc).toHaveBeenCalledWith(4)
    })
    it('should return index according to key function and map function result', () => {
      expect(result.get('2', '3')).toEqual(3)
      expect(result.get('4', '5')).toEqual(5)
      expect(result.get('1', '2')).toBeUndefined()
    })
  })

  describe('buildMultiIndex', () => {
    // Defining builder as const to avoid having to define its type explicitly
    const builder = buildMultiIndex<number>()
      .addIndex({
        name: 'even',
        filter: item => item % 2 === 0,
        key: item => [item.toString()],
        map: item => item + 1,
      })
      .addIndex({
        name: 'odd',
        filter: item => item % 2 === 1,
        key: item => [item.toString()],
      })
      .addIndex({
        name: 'all',
        key: item => (item === 10 ? ['all', undefined as unknown as string] : ['all', item.toString()]),
      })

    it('should build multiple indices in one iteration', async () => {
      const { even, odd, all } = await builder.process(items)
      expect(even.get('2')).toEqual(3)
      expect(even.get('4')).toEqual(5)
      expect(even.get('1')).toBeUndefined()

      expect(odd.get('1')).toEqual(1)
      expect(odd.get('3')).toEqual(3)
      expect(odd.get('2')).toBeUndefined()

      expect(all.get('all', '1')).toEqual(1)
      expect(all.get('all', '2')).toEqual(2)
      expect(all.get('all', '3')).toEqual(3)
      expect(all.get('all', '4')).toEqual(4)
    })
    it('should be able to process different iterables with the same builder', async () => {
      const { even, odd, all } = await builder.process(toAsyncIterable([5, 6]))
      expect(even.get('6')).toEqual(7)
      expect(even.get('5')).toBeUndefined()

      expect(odd.get('5')).toEqual(5)
      expect(odd.get('6')).toBeUndefined()

      expect(all.get('all', '5')).toEqual(5)
      expect(all.get('all', '6')).toEqual(6)
    })
    it('should omit values where the key function returns undefined', async () => {
      const { all } = await builder.process(toAsyncIterable([9, 10]))
      expect(all.get('all', '9')).toEqual(9)
      expect(all.get('all', '10')).toBeUndefined()
    })
  })
})
