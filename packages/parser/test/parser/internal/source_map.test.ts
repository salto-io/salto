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
import { ElemID } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SourceMap } from '../../../src/parser/source_map'
import { SourceRange } from '../../../src/parser/parse'

describe('tree source map', () => {
  const createPos = (col: number, line: number, byte: number): SourceRange => ({
    start: { line, col, byte },
    end: { line, col, byte },
    filename: 'none',
  })
  const baseEntries: [string, SourceRange[]][] = [
    ['salesforce.test', [createPos(1, 1, 1)]],
    ['salesforce.test.a', [createPos(2, 2, 2)]],
    ['salesforce.test.a.b', [createPos(3, 3, 3)]],
    ['salesforce.test.b', [createPos(4, 4, 4)]],
    ['salto', [createPos(5, 5, 5)]],
  ]

  it('should add all values', () => {
    const sourceMap = new SourceMap(baseEntries)
    expect(wu(sourceMap.entries()).toArray()).toEqual(baseEntries)
    expect(sourceMap.size).toEqual(5)
  })

  it('should set non exsiting coplex key', () => {
    const sourceMap = new SourceMap()
    const value = [createPos(1, 2, 3)]
    const key = 'a.b.c'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
  })

  it('should return proper has value', () => {
    const sourceMap = new SourceMap()
    const value = [createPos(1, 2, 3)]
    const key = 'a.b.c'
    sourceMap.set(key, value)
    expect(sourceMap.has(key)).toBeTruthy()
    expect(sourceMap.has('nope.nope')).toBeFalsy()
  })

  it('should delete keys', () => {
    const sourceMap = new SourceMap()
    const value = [createPos(1, 2, 3)]
    const key = 'a.b.c'
    sourceMap.set(key, value)
    expect(sourceMap.has(key)).toBeTruthy()
    sourceMap.delete(key)
    expect(sourceMap.has(key)).toBeFalsy()
  })

  it('should delete all entries on clear', () => {
    const sourceMap = new SourceMap(baseEntries)
    expect(wu(sourceMap.keys()).toArray()).toEqual(baseEntries.map(([k, _v]) => k))
    sourceMap.clear()
    expect(wu(sourceMap.keys()).toArray()).toEqual([])
  })

  it('should update an existing value', () => {
    const sourceMap = new SourceMap()
    const value = [createPos(1, 2, 3)]
    const key = 'a.b.c'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
    const newValue = [createPos(2, 3, 4)]
    sourceMap.set(key, newValue)
    expect(sourceMap.get(key)).toEqual(newValue)
  })

  it('should allow push operations', () => {
    const sourceMap = new SourceMap()
    const value = createPos(1, 2, 3)
    const key = 'salto.type.instance.test.foo'
    sourceMap.set(key, [value])
    expect(sourceMap.get(key)).toEqual([value])
    const elemID = ElemID.fromFullName(key)
    const newValue = createPos(2, 3, 4)
    const anotherNewValue = createPos(3, 4, 5)
    sourceMap.push(elemID.getFullName(), newValue, anotherNewValue)
    expect(sourceMap.get(key)).toEqual([value, newValue, anotherNewValue])
  })

  it('should update partial key without deleting its children', () => {
    const sourceMap = new SourceMap()
    const value = [createPos(1, 2, 3)]
    const key = 'a.b.c'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
    const newKey = 'a.b'
    const newValue = [createPos(2, 3, 4)]
    sourceMap.set(newKey, newValue)
    expect(sourceMap.get(key)).toEqual(value)
    expect(sourceMap.get(newKey)).toEqual(newValue)
  })

  it('should push partial key without deleting its children', () => {
    const sourceMap = new SourceMap()
    const value = [createPos(1, 2, 3)]
    const key = 'salto.type.instance.test.foo'
    sourceMap.set(key, value)
    expect(sourceMap.get(key)).toEqual(value)
    const newKey = 'salto.type.instance.test'
    const elemID = ElemID.fromFullName(newKey)
    const newValue = createPos(2, 3, 4)
    sourceMap.push(elemID.getFullName(), newValue)
    expect(sourceMap.get(key)).toEqual(value)
    expect(sourceMap.get(newKey)).toEqual([newValue])
  })

  it('should return undefined for a non-existing value', () => {
    const sourceMap = new SourceMap()
    expect(sourceMap.get('eagle.has.landed')).toBeUndefined()
  })

  it('should return all keys', () => {
    const sourceMap = new SourceMap(baseEntries)
    expect(wu(sourceMap.keys()).toArray()).toEqual(baseEntries.map(([k, _v]) => k))
  })

  it('should return all values', () => {
    const sourceMap = new SourceMap(baseEntries)
    expect(wu(sourceMap.values()).toArray()).toEqual(baseEntries.map(([_k, v]) => v))
  })

  it('should support forEach', () => {
    const sourceMap = new SourceMap(_.cloneDeep(baseEntries))
    wu(sourceMap.values()).toArray()
    sourceMap.forEach(v => v.push(createPos(0, 0, 0)))
    expect(wu(sourceMap.values()).toArray()).toEqual(baseEntries.map(([_k, v]) => [...v, createPos(0, 0, 0)]))
  })

  it('should allow mount operations when prefix is new', () => {
    const sourceMap = new SourceMap(baseEntries)
    const mountMap = new SourceMap(baseEntries)
    const mountKey = 'mount.key'
    sourceMap.mount(mountKey, mountMap)
    baseEntries.forEach(([key, ranges]) => {
      expect(sourceMap.get(key)).toEqual(ranges)
      expect(sourceMap.get([mountKey, key].join(ElemID.NAMESPACE_SEPARATOR))).toEqual(ranges)
    })
  })

  it('should allow mount operations when prefix is old', () => {
    const sourceMap = new SourceMap(baseEntries)
    const mountMap = new SourceMap(baseEntries)
    const mountKey = 'mount.key'
    sourceMap.set(mountKey, [createPos(6, 6, 6)])
    sourceMap.mount(mountKey, mountMap)
    baseEntries.forEach(([key, ranges]) => {
      expect(sourceMap.get(key)).toEqual(ranges)
      expect(sourceMap.get([mountKey, key].join(ElemID.NAMESPACE_SEPARATOR))).toEqual(ranges)
    })
  })

  it('should allow merge operations', () => {
    const newEntries: [string, SourceRange[]][] = [
      ['salesforce.test', [createPos(2, 2, 2)]], // merge for existing
      ['salesforce.test.c.b', [createPos(4, 4, 4)]], // merge for a new mid key
      ['salesforce.test.d', [createPos(5, 5, 5)]], // merge for a new end key
      ['salesforce.test.a.b', [createPos(6, 6, 6)]], // Merge Leaf
      ['new', [createPos(6, 6, 6)]],
    ]
    const newSourceMap = new SourceMap(newEntries)
    const sourceMap = new SourceMap(baseEntries)
    sourceMap.merge(newSourceMap)
    ;[...baseEntries, ...newEntries].forEach(([key, values]) => {
      values.forEach(value => expect(sourceMap.get(key)?.find(r => _.isEqual(r, value))).toBeTruthy())
    })
  })
})
