import wu from 'wu'
import { SetId } from './set'

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(readonly initDefault: (key: K) => V, entries?: Iterable<[K, V]>) {
    super(wu(entries || []))
  }

  get(key: K): V {
    if (this.has(key)) {
      return super.get(key) as V
    }
    const res = this.initDefault(key)
    this.set(key, res)
    return res
  }
}

export interface DefaultMap<K, V> extends Map<K, V> {
  get(key: K): V
}

export const groupBy = <T>(elements: Iterable<T>, groupFunc: (t: T) => SetId): Map<SetId, T[]> => (
  new Map(wu(elements).reduce(
    (groupMap, elem) => { groupMap.get(groupFunc(elem)).push(elem); return groupMap },
    new DefaultMap<SetId, T[]>(() => []),
  ))
)
