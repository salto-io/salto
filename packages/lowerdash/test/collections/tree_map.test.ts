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
import wu from 'wu'
import _ from 'lodash'
import { TreeMap } from '../../src/collections/tree_map'

describe('tree map', () => {
  const separator = '|'

  const baseEntries: [string, string[]][] = [
    ['salesforce|test', ['test']],
    ['salesforce|test|a', ['test_a']],
    ['salesforce|test|a|b', ['test_a_b']],
    ['salesforce|test|b', ['test_b']],
    ['salto', ['salto']],
  ]

  it('should add all values', () => {
    const sourceMap = new TreeMap(baseEntries, separator)
    expect(wu(sourceMap.entries()).toArray()).toEqual(baseEntries)
    expect(sourceMap.size).toEqual(5)
  })

  it('should set non existing complex key', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['new_value']
    const key = 'a|b|c'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
  })

  it('should set non existing complex key even if it is an inherited property', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['new_value']
    const key = 'a|toString|b'
    expect(sourceMap.get(key)).toBeUndefined()
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
  })
  it('should return proper has value', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['new_value']
    const key = 'a|b|c'
    sourceMap.set(key, value)
    expect(sourceMap.has(key)).toBeTruthy()
    expect(sourceMap.has('nope.nope')).toBeFalsy()
  })

  it('should delete keys', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['new_value']
    const key = 'a|b|c'
    sourceMap.set(key, value)
    expect(sourceMap.has(key)).toBeTruthy()
    sourceMap.delete(key)
    expect(sourceMap.has(key)).toBeFalsy()
    expect(sourceMap.delete('no|such|key')).toBeFalsy()
  })

  it('should delete all entries on clear', () => {
    const sourceMap = new TreeMap(baseEntries, separator)
    expect(wu(sourceMap.keys()).toArray()).toEqual(baseEntries.map(([k, _v]) => k))
    sourceMap.clear()
    expect(wu(sourceMap.keys()).toArray()).toEqual([])
  })

  it('should update an existing value', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['value']
    const key = 'a|b|c'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
    const newValue = ['new_value']
    sourceMap.set(key, newValue)
    expect(sourceMap.get(key)).toEqual(newValue)
  })

  it('should allow push operations', () => {
    const sourceMap = new TreeMap([], separator)
    const value = 'new_value'
    const key = 'salto|type|instance|test|foo'
    sourceMap.set(key, [value])
    expect(sourceMap.get(key)).toEqual([value])
    const newValue = 'new_value'
    const anotherNewValue = 'another_new_value'
    sourceMap.push(key, newValue, anotherNewValue)
    expect(sourceMap.get(key)).toEqual([value, newValue, anotherNewValue])
  })

  it('should update partial key without deleting its children', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['value']
    const key = 'a|b|c'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
    const newKey = 'a|b'
    const newValue = ['new_value']
    sourceMap.set(newKey, newValue)
    expect(sourceMap.get(key)).toEqual(value)
    expect(sourceMap.get(newKey)).toEqual(newValue)
  })

  it('should push partial key without deleting its children', () => {
    const sourceMap = new TreeMap([], separator)
    const value = ['value']
    const key = 'salto|type|instance|test|foo'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
    const newKey = 'salto|type|instance|test'
    const newValue = 'new_value'
    sourceMap.push(newKey, newValue)
    expect(sourceMap.get(key)).toEqual(value)
    expect(sourceMap.get(newKey)).toEqual([newValue])
  })

  it('should return undefined for a non-existing value', () => {
    const sourceMap = new TreeMap([], separator)
    expect(sourceMap.get('eagle|has|landed')).toBeUndefined()
  })

  it('should return all keys', () => {
    const sourceMap = new TreeMap(baseEntries, separator)
    expect(wu(sourceMap.keys()).toArray()).toEqual(baseEntries.map(([k, _v]) => k))
  })

  it('should return all values', () => {
    const sourceMap = new TreeMap(baseEntries, separator)
    expect(wu(sourceMap.values()).toArray()).toEqual(baseEntries.map(([_k, v]) => v))
  })

  it('should return the tree root', () => {
    const sourceMap = new TreeMap(_.cloneDeep(baseEntries), separator)
    expect(sourceMap.root).toMatchObject({
      value: [],
      children: {
        salto: {
          value: ['salto'],
          children: {},
        },
        salesforce: {
          value: [],
          children: {
            test: {
              value: ['test'],
              children: {
                a: {
                  value: ['test_a'],
                  children: {
                    b: {
                      value: ['test_a_b'],
                      children: {},
                    },
                  },
                },
                b: {
                  value: ['test_b'],
                  children: {},
                },
              },
            },
          },
        },
      },
    })
  })

  it('should support forEach', () => {
    const sourceMap = new TreeMap(_.cloneDeep(baseEntries), separator)
    wu(sourceMap.values()).toArray()
    sourceMap.forEach(v => v.push('pushed_value'))
    expect(wu(sourceMap.values()).toArray()).toEqual(baseEntries.map(([_k, v]) => [...v, 'pushed_value']))
  })

  it('should allow mount operations when prefix is new', () => {
    const sourceMap = new TreeMap(baseEntries, separator)
    const mountMap = new TreeMap(baseEntries, separator)
    const mountKey = 'mount|key'
    sourceMap.mount(mountKey, mountMap)
    baseEntries.forEach(([key, ranges]) => {
      expect(sourceMap.get(key)).toEqual(ranges)
      expect(sourceMap.get([mountKey, key].join(separator))).toEqual(ranges)
    })
  })

  it('should allow mount operations when prefix is old', () => {
    const sourceMap = new TreeMap(baseEntries, separator)
    const mountMap = new TreeMap(baseEntries, separator)
    const mountKey = 'mount|key'
    sourceMap.set(mountKey, ['mount_value'])
    sourceMap.mount(mountKey, mountMap)
    baseEntries.forEach(([key, ranges]) => {
      expect(sourceMap.get(key)).toEqual(ranges)
      expect(sourceMap.get([mountKey, key].join(separator))).toEqual(ranges)
    })
  })

  it('should allow merge operations', () => {
    const newEntries: [string, string[]][] = [
      ['salesforce|test', ['test_a']], // merge for existing
      ['salesforce|test|c|b', ['test_c_b']], // merge for a new mid key
      ['salesforce|test|d', ['test_d']], // merge for a new end key
      ['salesforce|test|a|b', ['test_a_b']], // Merge Leaf
      ['new', ['new']],
    ]
    const newSourceMap = new TreeMap(newEntries, separator)
    const sourceMap = new TreeMap(baseEntries, separator)
    sourceMap.merge(newSourceMap)
    ;[...baseEntries, ...newEntries].forEach(([key, values]) => {
      values.forEach(value => expect(sourceMap.get(key)?.find(r => _.isEqual(r, value))).toBeTruthy())
    })
  })

  it('should support a default constructor', () => {
    const newSourceMap = new TreeMap()
    expect(newSourceMap).toBeInstanceOf(TreeMap)
  })

  describe('valuesWithPrefix', () => {
    let tree: TreeMap<string>
    beforeEach(() => {
      tree = new TreeMap(baseEntries, separator)
    })
    describe('when iterating a prefix that exists', () => {
      let iteratedValues: string[][]
      beforeEach(() => {
        iteratedValues = [...tree.valuesWithPrefix('salesforce|test')]
      })
      it('should iterate all values with the given prefix', () => {
        expect(iteratedValues).toEqual(
          baseEntries.filter(([key]) => key.startsWith('salesforce|test')).map(([_key, value]) => value),
        )
      })
    })
    describe('when iterating a prefix that does not exist', () => {
      let iteratedValues: string[][]
      beforeEach(() => {
        iteratedValues = [...tree.valuesWithPrefix('salesforce|test|no|such|prefix')]
      })
      it('should return an empty iterator', () => {
        expect(iteratedValues).toHaveLength(0)
      })
    })
  })
})
