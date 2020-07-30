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
import wu from 'wu'

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(readonly initDefault: (key: K) => V, entries?: Iterable<[K, V]>) {
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

export interface DefaultMap<K, V> extends Map<K, V> {
  get(key: K): V
}
