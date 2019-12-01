import _ from 'lodash'
import { ElemID } from 'adapter-api'
import { SourceRange, isSourceRange } from './types'

// interface SourceMapEntry {
//   children: Record<string, SourceMapEntry>
//   value: SourceRange[]
// }

const CHILDREN = 0
const VALUE = 1
type SourceMapEntry = [Record<string, SourceMapEntry>, SourceRange[]]

const setToPath = (
  data: SourceMapEntry,
  path: string[],
  value: SourceRange[]
): boolean => {
  const [key, ...restOfPath] = path
  if (!data[CHILDREN][key]) {
    data[CHILDREN][key] = [{}, []]
  }
  if (_.isEmpty(restOfPath)) {
    const newItem = _.isEmpty(data[CHILDREN][key][VALUE])
    data[CHILDREN][key][VALUE] = value.map(r => {
      return {...r, filename: r.filename? r.filename[0] : ''}
    })
    return newItem
  }
  return setToPath(data[CHILDREN][key], restOfPath, value)
}

const getFromPath = (
  data: SourceMapEntry,
  path: string[]
): SourceMapEntry | undefined => {
  const [key, ...restOfPath] = path
  if (_.isEmpty(restOfPath)) {
    return data[CHILDREN][key]
  }
  return data[CHILDREN][key] ? getFromPath(data[CHILDREN][key], restOfPath) : undefined
}

export class SourceMap implements Map<string, SourceRange[]> {
  [Symbol.toStringTag] = 'SourceMap Map'
  private numOfEntries = 0
  private data: SourceMapEntry = [{},[]];

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

  get size(): number { return this.numOfEntries }

  push(id: ElemID, source: SourceRange | { source: SourceRange }): void {
    const key = id.getFullName().split(ElemID.NAMESPACE_SEPARATOR)
    const sourceRangeO = isSourceRange(source) ? source : source.source
    const sourceRange = {... sourceRangeO, filename: sourceRangeO.filename[0]}
    const sourceRangeList = getFromPath(this.data, key)
    if (sourceRangeList) {
      sourceRangeList[VALUE].push(sourceRange)
    } else {
      setToPath(this.data, key, [sourceRange])
    }
  }

  set(id: string, source: SourceRange[]): this {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    if (setToPath(this.data, path, source)) {
      this.numOfEntries += 1
    }
    return this
  }

  get(id: string): SourceRange[] | undefined {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    const entry = getFromPath(this.data, path)
    return entry && entry[VALUE]
  }

  has(id: string): boolean {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    return getFromPath(this.data, path) !== undefined
  }

  clear(): void {
    this.data = [{},[]]
  }

  delete(id: string): boolean {
    const path = id.split(ElemID.NAMESPACE_SEPARATOR)
    const lastPart = path.pop()
    const entry = getFromPath(this.data, path)
    if (entry && lastPart) {
      const deleted = delete entry[CHILDREN][lastPart]
      if (deleted) this.numOfEntries -= 1
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
    return JSON.stringify(this)
  }

  static deserialize(json: string): SourceMap {
    const raw = JSON.parse(json)
    const res = new SourceMap()
    res.data = raw.data
    res.numOfEntries = raw.numOfEntries
    return res
  }
}
