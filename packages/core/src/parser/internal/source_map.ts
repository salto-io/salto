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
import { ElemID } from '@salto-io/adapter-api'
import wu from 'wu'
import { SourceRange, isSourceRange } from './types'

interface SourceMapEntry {
  children: Record<string, SourceMapEntry>
  value: SourceRange[]
}

const mergeEntries = (src: SourceMapEntry, target: SourceMapEntry): void => {
  src.value.push(...target.value)
  // eslint-disable-next-line no-restricted-syntax
  for (const key in target.children) {
    if (src.children[key]) {
      mergeEntries(src.children[key] as SourceMapEntry, target.children[key])
    } else {
      src.children[key] = target.children[key]
    }
  }
}

const mountToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceMapEntry
): void => {
  const [key, ...restOfPath] = path
  if (!data.children[key]) {
    data.children[key] = { children: {}, value: [] }
  }
  if (_.isEmpty(restOfPath)) {
    if (data.children[key]) {
      return mergeEntries(data.children[key], value)
    }
    data.children[key] = value
  }
  return mountToPath(data.children[key], restOfPath, value)
}

const setToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceRange[]
): void => {
  const [key, ...restOfPath] = path
  if (!data.children[key]) {
    data.children[key] = { children: {}, value: [] }
  }
  if (_.isEmpty(restOfPath)) {
    data.children[key].value = value
    return
  }
  setToPath(data.children[key], restOfPath, value)
}

const getFromPath = (
  data: SourceMapEntry,
  path: string[],
  debug = false
): SourceMapEntry | undefined => {
  const [key, ...restOfPath] = path
  if (_.isEmpty(restOfPath)) {
    return data.children[key]
  }
  return data.children[key] ? getFromPath(data.children[key], restOfPath, debug) : undefined
}

export class SourceMap implements Map<string, SourceRange[]> {
  [Symbol.toStringTag] = 'SourceMap'
  private data: SourceMapEntry = { children: {}, value: [] }

  constructor(entries: Iterable<[string, SourceRange[]]> = []) {
    wu(entries).forEach(([key, value]: [string, SourceRange[]]) => this.set(key, value))
  }

  private *createGenerator(
    baseEntry?: SourceMapEntry,
    prefix: string[] = [],
  ): Generator<[string, SourceRange[]]> {
    const data = baseEntry || this.data
    if (!_.isEmpty(data.value)) yield [prefix.join(ElemID.NAMESPACE_SEPARATOR), data.value]
    // eslint-disable-next-line no-restricted-syntax
    for (const key of _.keys(data.children)) {
      const itr = this.createGenerator(data.children[key], [...prefix, key])
      yield* itr
    }
  }

  [Symbol.iterator](): Generator<[string, SourceRange[]]> {
    return this.createGenerator()
  }

  get size(): number { return wu(this.keys()).toArray().length }

  push(id: string, ...sources: (SourceRange | { source: SourceRange })[]): void {
    const key = id.split(ElemID.NAMESPACE_SEPARATOR)
    const sourceRangeList = getFromPath(this.data, key)
    const ranges = sources.map(s => (isSourceRange(s) ? s : s.source))
    if (sourceRangeList) {
      sourceRangeList.value.push(...ranges)
    } else {
      setToPath(this.data, key, ranges)
    }
  }

  set(id: string, source: SourceRange[]): this {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    setToPath(this.data, path, source)
    return this
  }

  get(id: string): SourceRange[] | undefined {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    const entry = getFromPath(this.data, path)
    return entry && entry.value
  }

  has(id: string): boolean {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    return getFromPath(this.data, path) !== undefined
  }

  clear(): void {
    this.data = { children: {}, value: [] }
  }

  mount(baseId: string, otherMap: SourceMap): void {
    const path = baseId.split(ElemID.NAMESPACE_SEPARATOR)
    mountToPath(this.data, path, otherMap.data)
  }

  merge(otherMap: SourceMap): void {
    mergeEntries(this.data, otherMap.data)
  }

  delete(id: string): boolean {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    const lastPart = path.pop()
    const entry = getFromPath(this.data, path)
    if (entry && lastPart) {
      const deleted = delete entry.children[lastPart]
      return deleted
    }
    return false
  }

  keys(): IterableIterator<string> {
    const r = wu(this.createGenerator()).map(([key, _range]) => key)
    return r
  }

  entries(): Generator<[string, SourceRange[]]> {
    return this.createGenerator()
  }

  values(): IterableIterator<SourceRange[]> {
    return wu(this.createGenerator()).map(([_key, value]) => value)
  }

  forEach(
    callbackfn: (value: SourceRange[], key: string, map: Map<string, SourceRange[]>) => void,
  ): void {
    wu(this.createGenerator()).forEach(([key, value]) => callbackfn(value, key, this))
  }

  serialize(): string {
    return JSON.stringify(Array.from(this.entries()))
  }

  static deserialize(json: string): SourceMap {
    const raw = JSON.parse(json)
    const res = new SourceMap(raw)
    return res
  }
}
