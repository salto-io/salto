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
import wu, { WuIterable } from 'wu'
import { SourceRange, isSourceRange } from './internal/types'

interface SourceMapEntry {
  children: Record<string, SourceMapEntry>
  value: SourceRange[]
}

const getFromPath = (
  data: SourceMapEntry,
  path: string[],
  createIfMissing = false
): SourceMapEntry | undefined => {
  if (_.isEmpty(path)) {
    return data
  }
  const [key, ...restOfPath] = path
  if (data.children[key] === undefined && createIfMissing) {
    data.children[key] = { children: {}, value: [] }
  }
  if (_.isEmpty(restOfPath)) {
    return data.children[key]
  }
  return data.children[key]
    ? getFromPath(data.children[key], restOfPath, createIfMissing)
    : undefined
}

const mergeEntries = (src: SourceMapEntry, target: SourceMapEntry): void => {
  src.value.push(...target.value)
  _.entries(target.children).forEach(([key, value]) => {
    if (key in src.children) {
      mergeEntries(src.children[key] as SourceMapEntry, value)
    } else {
      src.children[key] = value
    }
  })
}

const mountToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceMapEntry
): void => {
  const target = getFromPath(data, path, true)
  if (target !== undefined) {
    mergeEntries(target, value)
  }
}

const setToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceRange[]
): void => {
  const target = getFromPath(data, path, true)
  if (target !== undefined) {
    target.value = value
  }
}

const iterEntry = (
  entry: SourceMapEntry,
  prefix: string[] = []
): WuIterable<[string, SourceRange[]]> => {
  const childEntries = wu.entries(entry.children)
    .map(([key, child]) => iterEntry(child, [...prefix, key]))
    .flatten(true)
  return _.isEmpty(entry.value)
    ? childEntries
    : wu.chain([[prefix.join(ElemID.NAMESPACE_SEPARATOR), entry.value]], childEntries)
}

export class SourceMap implements Map<string, SourceRange[]> {
  [Symbol.toStringTag] = 'SourceMap'
  private data: SourceMapEntry = { children: {}, value: [] }

  constructor(entries: Iterable<[string, SourceRange[]]> = []) {
    wu(entries).forEach(([key, value]) => this.set(key, value))
  }

  [Symbol.iterator](): IterableIterator<[string, SourceRange[]]> {
    return iterEntry(this.data)
  }

  get size(): number { return wu.reduce(count => count + 1, 0, this) }

  push(id: string, ...sources: (SourceRange | { source: SourceRange })[]): void {
    const key = id.split(ElemID.NAMESPACE_SEPARATOR)
    const sourceRangeList = getFromPath(this.data, key)
    const ranges = sources.map(s => (isSourceRange(s) ? s : s.source))
    if (sourceRangeList !== undefined) {
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
    return entry?.value
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
    if (entry !== undefined && lastPart) {
      return delete entry.children[lastPart]
    }
    return false
  }

  keys(): IterableIterator<string> {
    return iterEntry(this.data).map(([key, _range]) => key)
  }

  entries(): IterableIterator<[string, SourceRange[]]> {
    return iterEntry(this.data)
  }

  values(): IterableIterator<SourceRange[]> {
    return iterEntry(this.data).map(([_key, value]) => value)
  }

  forEach(
    callbackfn: (value: SourceRange[], key: string, map: Map<string, SourceRange[]>) => void,
  ): void {
    iterEntry(this.data).forEach(([key, value]) => callbackfn(value, key, this))
  }
}
