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

export type RemoteMap<T> = {
  delete(key: string): Promise<boolean>
  get(key: string): Promise<T | undefined>
  has(key: string): Promise<boolean>
  set(key: string, value: T): Promise<void>
  setAll(values: ThenableIterable<[string, T]>): Promise<void>
  entries(): AsyncIterable<[string, T]>
  keys(): AsyncIterable<string>
  values(): AsyncIterable<T>
  clear(): Promise<void>
}

// This is for now. Don't commit this K?
export class InMemoryRemoteMap<T> implements RemoteMap<T> {
  private data: Map<string, T>

  constructor(public name: string) {
    this.data = new Map()
  }

  async setAll(values: ThenableIterable<[string, T]>): Promise<void> {
    for await (const [k, v] of values) {
      this.data.set(k, v)
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key)
  }

  async get(key: string): Promise<T | undefined> {
    return this.data.get(key)
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key)
  }

  async set(key: string, value: T): Promise<void> {
    this.data.set(key, value)
  }

  async clear(): Promise<void> {
    this.data = new Map()
  }

  entries(): AsyncIterable<[string, T]> {
    return toAsyncIterable(this.data.entries())
  }

  keys(): AsyncIterable<string> {
    return toAsyncIterable(this.data.keys())
  }

  values(): AsyncIterable<T> {
    return toAsyncIterable(this.data.values())
  }

  get [Symbol.toStringTag](): string {
    return `[RemoteMap ${this.name}]`
  }
}
