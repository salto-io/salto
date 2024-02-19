/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import wu from 'wu'

const { toAsyncIterable, awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export type IterationOpts = {
  first?: number
  after?: string
  pageSize?: number
  filter?: (key: string) => boolean
}

export type PagedIterationOpts = IterationOpts & {
  pageSize: number
}

export const isPagedIterationOpts = (opts: IterationOpts): opts is PagedIterationOpts => {
  if (opts.pageSize === undefined) {
    return false
  }
  if (opts.pageSize <= 0 || !Number.isInteger(opts.pageSize)) {
    throw new Error('Iteration page size must be a positive integer')
  }
  return true
}

export type RemoteMapEntry<T, K extends string = string> = { key: K; value: T }
export type RemoteMapType = 'workspace' | 'state'

export interface CreateRemoteMapParams<T> {
  namespace: string
  batchInterval?: number
  persistent: boolean
  serialize: (value: T) => Promise<string>
  deserialize: (s: string) => Promise<T>
}

export interface CreateReadOnlyRemoteMapParams<T> {
  namespace: string
  deserialize: (s: string) => Promise<T>
}

export type RemoteMapIterator<T, Opts> = Opts extends PagedIterationOpts
  ? AsyncIterable<T[]>
  : Opts extends IterationOpts
    ? AsyncIterable<T>
    : never

export type RemoteMapIteratorCreator<T, Opts extends IterationOpts = IterationOpts> = (
  opts?: Opts,
) => RemoteMapIterator<T, Opts>

export type RemoteMap<T, K extends string = string> = {
  delete(key: K): Promise<void>
  get(key: K): Promise<T | undefined>
  getMany(keys: K[]): Promise<(T | undefined)[]>
  has(key: K): Promise<boolean>
  set(key: K, value: T): Promise<void>
  setAll(values: ThenableIterable<RemoteMapEntry<T, K>>): Promise<void>
  deleteAll(keys: ThenableIterable<K>): Promise<void>
  entries: RemoteMapIteratorCreator<RemoteMapEntry<T, K>>
  keys: RemoteMapIteratorCreator<K>
  values: RemoteMapIteratorCreator<T>
  flush: () => Promise<boolean>
  revert: () => Promise<void>
  clear(): Promise<void>
  close(): Promise<void>
  isEmpty(): Promise<boolean>
}

export type ReadOnlyRemoteMap<T> = Pick<RemoteMap<T>, 'get' | 'entries' | 'values' | 'has'>

export type RemoteMapCreator = <T, K extends string = string>(
  opts: CreateRemoteMapParams<T>,
) => Promise<RemoteMap<T, K>>

export type ReadOnlyRemoteMapCreator = <T, K extends string = string>(
  opts: CreateReadOnlyRemoteMapParams<T>,
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

  getSortedEntries = (): [K, T][] => _.sortBy(Array.from(this.data.entries()), [e => e[0]])

  entries<Opts extends IterationOpts>(opts?: Opts): RemoteMapIterator<RemoteMapEntry<T, K>, Opts> {
    const sortedEntries = this.getSortedEntries().map(e => ({ key: e[0], value: e[1] }))
    if (opts && isPagedIterationOpts(opts)) {
      return toAsyncIterable(wu(sortedEntries).chunk(opts.pageSize)) as RemoteMapIterator<RemoteMapEntry<T, K>, Opts>
    }
    return toAsyncIterable(sortedEntries) as RemoteMapIterator<RemoteMapEntry<T, K>, Opts>
  }

  keys<Opts extends IterationOpts>(opts?: Opts): RemoteMapIterator<K, Opts> {
    const sortedKeys = Array.from(this.data.keys()).sort()
    if (opts && isPagedIterationOpts(opts)) {
      return toAsyncIterable(wu(sortedKeys).chunk(opts.pageSize)) as RemoteMapIterator<K, Opts>
    }
    return toAsyncIterable(sortedKeys) as RemoteMapIterator<K, Opts>
  }

  values<Opts extends IterationOpts>(opts?: Opts): RemoteMapIterator<T, Opts> {
    const sortedValues = this.getSortedEntries().map(e => e[1])
    if (opts && isPagedIterationOpts(opts)) {
      return toAsyncIterable(wu(sortedValues).chunk(opts.pageSize)) as RemoteMapIterator<T, Opts>
    }
    return toAsyncIterable(sortedValues) as RemoteMapIterator<T, Opts>
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
  func: (orig: T) => Promise<R>,
): ReadOnlyRemoteMap<R> => ({
  get: async id => {
    const origValue = await source.get(id)
    return origValue !== undefined ? func(origValue) : undefined
  },
  entries: () => awu(source.entries()).map(async entry => ({ ...entry, value: await func(entry.value) })),
  values: () => awu(source.values()).map(func),
  has: id => source.has(id),
})
