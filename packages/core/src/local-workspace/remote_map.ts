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

export class LocalRemoteMap<T> {
    private data: Map<string, T>

    constructor(public name: string) {
      this.data = new Map()
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
      this.set(key, value)
    }

    [Symbol.asyncIterator](): AsyncIterable<[string, T]> {
      return toAsyncIterable(this.data.entries())
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
