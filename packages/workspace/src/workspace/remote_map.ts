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
import { collections } from '@salto-io/lowerdash'

const { toAsyncIterable, awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export type IterationOpts = {
  first?: number
  after?: string
}

export type RemoteMapEntry<T, K extends string = string> = { key: K; value: T }
export type RemoteMapType = 'workspace' | 'state'

export interface CreateRemoteMapParams<T> {
  namespace: string
  batchInterval?: number
  LRUSize?: number
  serialize: (value: T) => string
  deserialize: (s: string) => Promise<T>
}

export type RemoteMap<T, K extends string = string> = {
  delete(key: K): Promise<void>
  get(key: K): Promise<T | undefined>
  has(key: K): Promise<boolean>
  set(key: K, value: T): Promise<void>
  setAll(values: ThenableIterable<RemoteMapEntry<T, K>>): Promise<void>
  entries(opts?: IterationOpts): AsyncIterable<RemoteMapEntry<T, K>>
  keys(opts?: IterationOpts): AsyncIterable<K>
  values(opts?: IterationOpts): AsyncIterable<T>
  flush: () => Promise<void>
  revert: () => Promise<void>
  clear(): Promise<void>
  close(): Promise<void>
}

export type RemoteMapCreator = <T, K extends string = string>(
  opts: CreateRemoteMapParams<T>
) => Promise<RemoteMap<T, K>>

// This is for now. Don't commit this K?
export class InMemoryRemoteMap<T, K extends string = string> implements RemoteMap<T, K> {
  private data: Map<K, T>
  constructor(data: [K, T][] = []) {
    this.data = new Map(data)
  }

  async setAll(entries: ThenableIterable<RemoteMapEntry<T, K>>): Promise<void> {
    for await (const entry of entries) {
      this.data.set(entry.key, entry.value)
    }
  }

  async delete(key: K): Promise<void> {
    this.data.delete(key)
  }

  async get(key: K): Promise<T | undefined> {
    return this.data.get(key)
  }

  async has(key: K): Promise<boolean> {
    return this.data.has(key)
  }

  async set(key: K, value: T): Promise<void> {
    this.data.set(key, value)
  }

  async clear(): Promise<void> {
    this.data = new Map()
  }

  entries(): AsyncIterable<RemoteMapEntry<T, K>> {
    return awu(this.data.entries()).map(e => ({ key: e[0], value: e[1] }))
  }

  keys(): AsyncIterable<K> {
    return toAsyncIterable(this.data.keys())
  }

  values(): AsyncIterable<T> {
    return toAsyncIterable(this.data.values())
  }

  // eslint-disable-next-line class-methods-use-this
  async flush(): Promise<void> {
    return Promise.resolve(undefined)
  }

  // eslint-disable-next-line class-methods-use-this
  async revert(): Promise<void> {
    return Promise.resolve(undefined)
  }

  // eslint-disable-next-line class-methods-use-this
  async close(): Promise<void> {
    return Promise.resolve(undefined)
  }

  [Symbol.toStringTag]: '[InMemoryRemoteMap]'
}
