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
import { SourceRange, isSourceRange } from './internal/types'
import wu from 'wu'

const CHILDREN = 0
const VALUE = 1
type SourceMapEntry = [Record<string, SourceMapEntry>, SourceRange[]]

const mergeEntries = (src: SourceMapEntry, target: SourceMapEntry): void => {
  src[VALUE].push(...target[VALUE])
  // eslint-disable-next-line no-restricted-syntax
  for (const key in target[CHILDREN]) {
    if (src[CHILDREN][key]) {
      mergeEntries(src[CHILDREN][key] as SourceMapEntry, target[CHILDREN][key])
    } else {
      src[CHILDREN][key] = target[CHILDREN][key]
    }
  }
}

const mountToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceMapEntry
): void => {
  const [key, ...restOfPath] = path
  if (!data[CHILDREN][key]) {
    data[CHILDREN][key] = [{}, []]
  }
  if (_.isEmpty(restOfPath)) {
    if (data[CHILDREN][key]) {
      return mergeEntries(data[CHILDREN][key], value)
    }
    data[CHILDREN][key] = value
  }
  return mountToPath(data[CHILDREN][key], restOfPath, value)
}

const setToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceRange[]
): void => {
  const [key, ...restOfPath] = path
  if (!data[CHILDREN][key]) {
    data[CHILDREN][key] = [{}, []]
  }
  if (_.isEmpty(restOfPath)) {
    data[CHILDREN][key][VALUE] = value
    return
  }
  return setToPath(data[CHILDREN][key], restOfPath, value)
}

const getFromPath = (
  data: SourceMapEntry,
  path: string[],
  debug = false
): SourceMapEntry | undefined => {
  const [key, ...restOfPath] = path
  if (_.isEmpty(restOfPath)) {
    return data[CHILDREN][key]
  }
  return data[CHILDREN][key] ? getFromPath(data[CHILDREN][key], restOfPath, debug) : undefined
}

export class SourceMap implements Map<string, SourceRange[]> {
  [Symbol.toStringTag] = 'SourceMap Map'
  private data: SourceMapEntry = [{}, []];

  private *createGenerator<T>(
    t: (entry: [string, SourceRange[]]) => T,
    baseEntry?: SourceMapEntry,
    prefix: string[] = [],
  ): Generator<T> {
    const data = baseEntry || this.data
    if (!_.isEmpty(data[VALUE])) yield t([prefix.join(ElemID.NAMESPACE_SEPARATOR), data[VALUE]])
    // eslint-disable-next-line no-restricted-syntax
    for (const key of _.keys(data[CHILDREN])) {
      const itr = this.createGenerator(t, data[CHILDREN][key], [...prefix, key])
      yield* itr
    }
  }

  [Symbol.iterator](): Generator<[string, SourceRange[]]> {
    return this.createGenerator(e => e)
  }

  get size(): number { return wu(this.keys()).toArray().length }

  push(id: string, ...sources: (SourceRange | { source: SourceRange })[]): void {
    const key = id.split(ElemID.NAMESPACE_SEPARATOR)
    const sourceRangeList = getFromPath(this.data, key)
    const ranges = sources.map(s => (isSourceRange(s) ? s : s.source))
    if (sourceRangeList) {
      sourceRangeList[VALUE].push(...ranges)
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
    const debug = id === 'salesforce.lead.field.ext_field._default'
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    const entry = getFromPath(this.data, path, debug)
    return entry && entry[VALUE]
  }

  has(id: string): boolean {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    return getFromPath(this.data, path) !== undefined
  }

  clear(): void {
    this.data = [{}, []]
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
      const deleted = delete entry[CHILDREN][lastPart]
      return deleted
    }
    return false
  }

  keys(): Generator<string> {
    return this.createGenerator<string>(([key, _range]) => key)
  }

  entries(): Generator<[string, SourceRange[]]> {
    return this.createGenerator<[string, SourceRange[]]>(e => e)
  }

  values(): Generator<SourceRange[]> {
    return this.createGenerator<SourceRange[]>(([_key, value]) => value)
  }

  forEach(
    callbackfn: (value: SourceRange[], key: string, map: Map<string, SourceRange[]>) => void,
  ): void {
    const itr = this.createGenerator<[string, SourceRange[]]>(e => e)
    // eslint-disable-next-line no-restricted-syntax
    for (const e of itr) {
      const [key, value] = e
      callbackfn(value, key, this)
    }
  }

  serialize(): string {
    return JSON.stringify(Array.from(this.entries()))
  }

  static deserialize(json: string): SourceMap {
    const raw = JSON.parse(json)
    const res = new SourceMap()
    raw.forEach(([key, value]: [string, SourceRange[]]) => res.set(key, value))
    return res
  }
}
