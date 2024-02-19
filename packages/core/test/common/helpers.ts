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
import { Element } from '@salto-io/adapter-api'
import { elementSource, remoteMap } from '@salto-io/workspace'

export const createElementSource = (elements: readonly Element[]): elementSource.RemoteElementSource =>
  elementSource.createInMemoryElementSource(elements as Element[])

export const inMemRemoteMapCreator = (): remoteMap.RemoteMapCreator => {
  const maps = new Map<string, remoteMap.RemoteMap<unknown>>()
  return async <T, K extends string = string>(opts: remoteMap.CreateRemoteMapParams<T>) => {
    const map = maps.get(opts.namespace) ?? new remoteMap.InMemoryRemoteMap<T, K>()
    if (!maps.has(opts.namespace)) {
      maps.set(opts.namespace, map)
    }
    return map as remoteMap.RemoteMap<T, K>
  }
}
