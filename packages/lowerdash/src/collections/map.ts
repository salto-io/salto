/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(
    readonly initDefault: (key: K) => V,
    entries?: Iterable<[K, V]>,
  ) {
    super(wu(entries || []))
  }

  get(key: K): V {
    let result = super.get(key)
    if (result === undefined) {
      result = this.initDefault(key)
      this.set(key, result)
    }
    return result
  }

  getOrUndefined(key: K): V | undefined {
    return super.get(key)
  }
}
