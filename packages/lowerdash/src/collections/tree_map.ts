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
import _ from 'lodash'
import wu, { WuIterable } from 'wu'

export interface TreeMapEntry<T> {
  children: Record<string, TreeMapEntry<T>>
  value: T[]
}

export class TreeMap<T> implements Map<string, T[]> {
  [Symbol.toStringTag] = 'TreeMap'
  protected data: TreeMapEntry<T> = { children: {}, value: [] }

  constructor(
    entries: Iterable<[string, T[]]> = [],
    public separator = '.',
  ) {
    wu(entries).forEach(([key, value]) => this.push(key, ...value))
  }

  protected static getFromPath = <S>(
    data: TreeMapEntry<S>,
    path: string[],
    createIfMissing = false,
  ): TreeMapEntry<S> | undefined => {
    if (_.isEmpty(path)) {
      return data
    }
    const [key, ...restOfPath] = path
    if (!Object.prototype.hasOwnProperty.call(data.children, key) && createIfMissing) {
      data.children[key] = { children: {}, value: [] }
    }
    if (Object.prototype.hasOwnProperty.call(data.children, key)) {
      return TreeMap.getFromPath(data.children[key], restOfPath, createIfMissing)
    }
    return undefined
  }

  protected static mergeEntries = <S>(src: TreeMapEntry<S>, target: TreeMapEntry<S>): void => {
    src.value.push(...target.value)
    _.entries(target.children).forEach(([key, value]) => {
      if (key in src.children) {
        TreeMap.mergeEntries(src.children[key] as TreeMapEntry<S>, value)
      } else {
        src.children[key] = value
      }
    })
  }

  protected static mountToPath = <S>(data: TreeMapEntry<S>, path: string[], value: TreeMapEntry<S>): void => {
    const target = TreeMap.getFromPath(data, path, true) as TreeMapEntry<S>
    TreeMap.mergeEntries(target, value)
  }

  protected static setToPath = <S>(data: TreeMapEntry<S>, path: string[], value: S[]): void => {
    const target = TreeMap.getFromPath(data, path, true) as TreeMapEntry<S>
    target.value = value
  }

  private iterEntry<S>(entry: TreeMapEntry<S>, prefix: string[] = []): WuIterable<[string, T[]]> {
    const childEntries = wu
      .entries(entry.children)
      .map(([key, child]) => this.iterEntry(child, [...prefix, key]))
      .flatten(true)
    return _.isEmpty(entry.value) ? childEntries : wu.chain([[prefix.join(this.separator), entry.value]], childEntries)
  }

  [Symbol.iterator](): IterableIterator<[string, T[]]> {
    return this.iterEntry(this.data)
  }

  get size(): number {
    return wu.reduce(count => count + 1, 0, this)
  }

  get root(): TreeMapEntry<T> {
    return this.data
  }

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

  forEach(callbackfn: (value: T[], key: string, map: Map<string, T[]>) => void): void {
    this.iterEntry(this.data).forEach(([key, value]) => callbackfn(value, key, this))
  }

  valuesWithPrefix(prefix: string): IterableIterator<T[]> {
    const path = prefix.split(this.separator)
    const prefixSubtree = TreeMap.getFromPath(this.data, path)
    if (prefixSubtree === undefined) {
      return wu([])
    }
    return this.iterEntry(prefixSubtree, path).map(([_key, values]) => values)
  }
}

export class PartialTreeMap<T> extends TreeMap<T> {}
