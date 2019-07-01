import wu from 'wu'

// disabled because there might be other Map-related utilities here
// eslint-disable-next-line import/prefer-default-export
export class DefaultMap<K, V> extends Map<K, V> {
  constructor(readonly initDefault: () => V, entries?: Iterable<[K, V]>) {
    super(wu(entries || []))
  }

  get(key: K): V {
    if (this.has(key)) {
      return super.get(key) as V
    }
    const res = this.initDefault()
    this.set(key, res)
    return res
  }
}
