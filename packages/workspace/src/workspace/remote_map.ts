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

const { toAsyncIterable } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export type RemoteMap<T, K extends string = string> = {
  delete(key: K): Promise<boolean>
  get(key: K): Promise<T | undefined>
  getSync(key: K): T | undefined
  has(key: K): Promise<boolean>
  set(key: K, value: T): Promise<void>
  setAll(values: ThenableIterable<[K, T]>): Promise<void>
  entries(): AsyncIterable<[K, T]>
  keys(): AsyncIterable<K>
  values(): AsyncIterable<T>
  clear(): Promise<void>
}

export type RemoteMapCreator<T> = (namespace: string) => RemoteMap<T>

// This is for now. Don't commit this K?
export class InMemoryRemoteMap<T, K extends string = string> implements RemoteMap<T, K> {
  private data: Map<K, T>
  constructor(data: [K, T][] = []) {
    this.data = new Map(data)
  }

  async setAll(values: ThenableIterable<[K, T]>): Promise<void> {
    for await (const [k, v] of values) {
      this.data.set(k, v)
    }
  }

  getSync(key: K): T | undefined {
    return this.data.get(key)
  }

  async delete(key: K): Promise<boolean> {
    return this.data.delete(key)
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

  entries(): AsyncIterable<[K, T]> {
    return toAsyncIterable(this.data.entries())
  }

  keys(): AsyncIterable<K> {
    return toAsyncIterable(this.data.keys())
  }

  values(): AsyncIterable<T> {
    return toAsyncIterable(this.data.values())
  }

  [Symbol.toStringTag]: '[InMemoryRemoteMap]'
}
