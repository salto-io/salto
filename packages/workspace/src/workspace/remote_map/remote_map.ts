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
export type RemoteMapOptions = {
  batchInterval: number
  LRUSize: number
  dbLocation: string
}
export type RemoteMap<T> = {
  get: (key: string) => Promise<T | undefined>
  values: () => AsyncIterable<T>
  entries: () => AsyncIterable<{ key: string; value: T }>
  set: (key: string, element: T) => Promise<void>
  putAll: (elements: AsyncIterable<T>) => Promise<void>
  list: () => AsyncIterable<string>
  destroy: () => void
  close: () => Promise<void>
  flush: () => Promise<void>
  revert: () => Promise<void>
}
