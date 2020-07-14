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
import wu, { WuIterable } from 'wu'

export interface TreeMapEntry<T> {
  children: Record<string, TreeMapEntry<T>>
  value: T[]
}

export class TreeMap<T> implements Map<string, T[]> {
  [Symbol.toStringTag] = 'TreeMap'
  protected data: TreeMapEntry<T> = { children: {}, value: [] }

  constructor(entries: Iterable<[string, T[]]> = [], public separator = '.') {
    wu(entries).forEach(([key, value]) => this.push(key, ...value))
  }

  protected static getFromPath = <T>(
    data: TreeMapEntry<T>,
    path: string[],
    createIfMissing = false,
    returnPartial = false
  ): TreeMapEntry<T> | undefined => {
    if (_.isEmpty(path)) {
      return data
    }
    const [key, ...restOfPath] = path
    if (data.children[key] === undefined && createIfMissing) {
      data.children[key] = { children: {}, value: [] }
    }
    if (data.children[key]) {
      return TreeMap.getFromPath(data.children[key], restOfPath, createIfMissing, returnPartial)
    }
    return returnPartial ? data : undefined
  }

  protected static mergeEntries = <T>(src: TreeMapEntry<T>, target: TreeMapEntry<T>): void => {
    src.value.push(...target.value)
    _.entries(target.children).forEach(([key, value]) => {
      if (key in src.children) {
        TreeMap.mergeEntries(src.children[key] as TreeMapEntry<T>, value)
      } else {
        src.children[key] = value
      }
    })
  }

  protected static mountToPath = <T>(
    data: TreeMapEntry<T>,
    path: string[],
    value: TreeMapEntry<T>
  ): void => {
    const target = TreeMap.getFromPath(data, path, true) as TreeMapEntry<T>
    TreeMap.mergeEntries(target, value)
  }

  protected static setToPath = <T>(
    data: TreeMapEntry<T>,
    path: string[],
    value: T[]
  ): void => {
    const target = TreeMap.getFromPath(data, path, true) as TreeMapEntry<T>
    target.value = value
  }

  private iterEntry<T>(
    entry: TreeMapEntry<T>,
    prefix: string[] = []
  ): WuIterable<[string, T[]]> {
    const childEntries = wu.entries(entry.children)
      .map(([key, child]) => this.iterEntry(child, [...prefix, key]))
      .flatten(true)
    return _.isEmpty(entry.value)
      ? childEntries
      : wu.chain([[prefix.join(this.separator), entry.value]], childEntries)
  }

  [Symbol.iterator](): IterableIterator<[string, T[]]> {
    return this.iterEntry(this.data)
  }

  get size(): number { return wu.reduce(count => count + 1, 0, this) }

  push(id: string, ...values: T[]): void {
    const key = id.split(this.separator)
    const valuesList = TreeMap.getFromPath(this.data, key)
    if (valuesList !== undefined) {
      valuesList.value.push(...values)
    } else {
      TreeMap.setToPath(this.data, key, values)
    }
  }

  set(id: string, source: T[]): this {
    const path = id.split(this.separator)
    TreeMap.setToPath(this.data, path, source)
    return this
  }

  get(id: string): T[] | undefined {
    const path = id.split(this.separator)
    const entry = TreeMap.getFromPath(this.data, path)
    return entry?.value
  }

  has(id: string): boolean {
    const path = id.split(this.separator)
    return TreeMap.getFromPath(this.data, path) !== undefined
  }

  clear(): void {
    this.data = { children: {}, value: [] }
  }

  mount(baseId: string, otherMap: TreeMap<T>): void {
    const path = baseId.split(this.separator)
    TreeMap.mountToPath(this.data, path, otherMap.data)
  }

  merge(otherMap: TreeMap<T>): void {
    TreeMap.mergeEntries(this.data, otherMap.data)
  }

  delete(id: string): boolean {
    const path = id.split(this.separator)
    const lastPart = path.pop()
    const entry = TreeMap.getFromPath(this.data, path)
    if (entry !== undefined && lastPart) {
      const deleted = delete entry.children[lastPart]
      return deleted
    }
    return false
  }

  keys(): IterableIterator<string> {
    return this.iterEntry(this.data).map(([key, _range]) => key)
  }

  entries(): IterableIterator<[string, T[]]> {
    return this.iterEntry(this.data)
  }

  values(): IterableIterator<T[]> {
    return this.iterEntry(this.data).map(([_key, value]) => value)
  }

  forEach(
    callbackfn: (value: T[], key: string, map: Map<string, T[]>) => void,
  ): void {
    this.iterEntry(this.data).forEach(([key, value]) => callbackfn(value, key, this))
  }
}

export class PartialTreeMap<T> extends TreeMap<T> {

}
