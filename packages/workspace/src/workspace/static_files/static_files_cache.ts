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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import * as remoteMap from '../remote_map'
import * as staticFiles from './cache'

const { awu } = collections.asynciterable

type StaticFilesCacheState = remoteMap.RemoteMap<staticFiles.StaticFilesData>

export const buildStaticFilesCache = (
  name: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
): staticFiles.StaticFilesCache => {
  const createRemoteMap = async (cacheName: string): Promise<StaticFilesCacheState> =>
    remoteMapCreator<staticFiles.StaticFilesData>({
      namespace: `staticFilesCache-${cacheName}`,
      serialize: async cacheEntry => safeJsonStringify(cacheEntry),
      deserialize: async data => JSON.parse(data),
      persistent,
    })

  let cache = createRemoteMap(name)

  return {
    get: async (filepath: string): Promise<staticFiles.StaticFilesData | undefined> => (await cache).get(filepath),
    put: async (item: staticFiles.StaticFilesData): Promise<void> => {
      await (await cache).set(item.filepath, item)
    },
    flush: async () => {
      await (await cache).flush()
    },
    clear: async () => {
      await (await cache).clear()
    },
    rename: async (newName: string) => {
      const currentCache = await cache
      const newCache = await createRemoteMap(newName)
      await newCache.setAll(currentCache.entries())
      cache = Promise.resolve(newCache)
      await currentCache.clear()
    },
    clone: () => buildStaticFilesCache(name, remoteMapCreator, persistent),
    list: async () => awu((await cache).keys()).toArray(),
  }
}
