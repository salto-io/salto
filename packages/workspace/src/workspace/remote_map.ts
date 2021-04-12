/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { AwuIterable } from '@salto-io/lowerdash/src/collections/asynciterable'

const { toAsyncIterable, awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export type IterationOpts<T = string> = {
  first?: number
  after?: string
  keyFilter?: (key: T) => boolean
}

export type RemoteMapEntry<T, K extends string = string> = { key: K; value: T }
export type RemoteMapType = 'workspace' | 'state'
export type ReadOnlyRemoteMap<T> = Pick<RemoteMap<T>, 'get'|'entries'|'values'|'has'>

export interface CreateRemoteMapParams<T> {
  namespace: string
  batchInterval?: number
  serialize: (value: T) => string
  deserialize: (s: string) => Promise<T>
}

export type RemoteMap<T, K extends string = string> = {
  delete(key: K): Promise<void>
  get(key: K): Promise<T | undefined>
  getMany(keys: K[]): Promise<(T | undefined)[]>
  has(key: K): Promise<boolean>
  set(key: K, value: T): Promise<void>
  setAll(values: ThenableIterable<RemoteMapEntry<T, K>>): Promise<void>
  deleteAll(keys: ThenableIterable<K>): Promise<void>
  entries(opts?: IterationOpts<K>): AsyncIterable<RemoteMapEntry<T, K>>
  keys(opts?: IterationOpts<K>): AsyncIterable<K>
  values(opts?: IterationOpts<K>): AsyncIterable<T>
  flush: () => Promise<boolean>
  revert: () => Promise<void>
  clear(): Promise<void>
  close(): Promise<void>
  isEmpty(): Promise<boolean>
}

export type RemoteMapCreator = <T, K extends string = string>(
  opts: CreateRemoteMapParams<T>
) => Promise<RemoteMap<T, K>>

export class InMemoryRemoteMap<T, K extends string = string> implements RemoteMap<T, K> {
  private data: Map<K, T>
  constructor(data: RemoteMapEntry<T, K>[] = []) {
    this.data = new Map(data.map(e => [e.key, e.value]))
  }

  async setAll(entries: ThenableIterable<RemoteMapEntry<T, K>>): Promise<void> {
    for await (const entry of entries) {
      this.data.set(entry.key, entry.value)
    }
  }

  async delete(key: K): Promise<void> {
    this.data.delete(key)
  }

  async deleteAll(keys: ThenableIterable<K>): Promise<void> {
    for await (const key of keys) {
      this.data.delete(key)
    }
  }

  async get(key: K): Promise<T | undefined> {
    return this.data.get(key)
  }

  async getMany(keys: K[]): Promise<(T | undefined)[]> {
    return keys.map(key => this.data.get(key))
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

  getSortedEntries = (opts?: IterationOpts<K>): AwuIterable<[K, T]> => awu(_.sortBy(Array
    .from(this.data.entries()), [e => e[0]]))
    .filter(entry => opts?.keyFilter === undefined || opts.keyFilter(entry[0]))

  entries(opts?: IterationOpts<K>): AsyncIterable<RemoteMapEntry<T, K>> {
    return this.getSortedEntries(opts).map(e => ({ key: e[0], value: e[1] }))
  }

  keys(opts?: IterationOpts<K>): AsyncIterable<K> {
    return awu(toAsyncIterable(Array.from(this.data.keys()).sort()))
      .filter(key => opts?.keyFilter === undefined || opts.keyFilter(key))
  }

  values(opts?: IterationOpts<K>): AsyncIterable<T> {
    return this.getSortedEntries(opts).map(e => e[1])
  }

  // eslint-disable-next-line class-methods-use-this
  async flush(): Promise<boolean> {
    return Promise.resolve(false)
  }

  // eslint-disable-next-line class-methods-use-this
  async revert(): Promise<void> {
    return Promise.resolve(undefined)
  }

  // eslint-disable-next-line class-methods-use-this
  async close(): Promise<void> {
    return Promise.resolve(undefined)
  }

  async isEmpty(): Promise<boolean> {
    return this.data.size === 0
  }

  [Symbol.toStringTag]: '[InMemoryRemoteMap]'
}

export const mapRemoteMapResult = <T, R>(
  source: ReadOnlyRemoteMap<T>,
  func: (orig: T) => Promise<R>
): ReadOnlyRemoteMap<R> => ({
    get: async id => {
      const origValue = await source.get(id)
      return origValue !== undefined ? func(origValue) : undefined
    },
    entries: () => awu(source.entries())
      .map(async entry => ({ ...entry, value: await func(entry.value) })),
    values: () => awu(source.values()).map(func),
    has: id => source.has(id),
  })
