/*
*                      Copyright 2023 Salto Labs Ltd.
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
import path from 'path'
import { readTextFile, exists, rm } from '@salto-io/file'
import { staticFiles, remoteMap } from '@salto-io/workspace'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

const log = logger(module)

type StaticFilesCacheState = remoteMap.RemoteMap<staticFiles.StaticFilesData>

const migrateLegacyStaticFilesCache = async (
  cacheDir: string,
  name: string,
  remoteCache: StaticFilesCacheState
): Promise<void> => {
  const CACHE_FILENAME = 'static-file-cache'
  const currentCacheFile = path.join(cacheDir, name, CACHE_FILENAME)

  if (await exists(currentCacheFile)) {
    if (await remoteCache.isEmpty()) {
      log.debug('importing legacy static files cache from file: %s', currentCacheFile)
      const oldCache: Record<string, staticFiles.StaticFilesData> = JSON.parse(
        await readTextFile(currentCacheFile)
      )
      await remoteCache.setAll(
        Object.values(oldCache).map(item => ({ value: item, key: item.filepath }))
      )
      await remoteCache.flush()
    } else {
      log.debug('static files cache already populated, ignoring legacy static files cache file: %s', currentCacheFile)
    }
    log.debug('deleting legacy static files cache file: %s', currentCacheFile)
    await rm(currentCacheFile)
  }
}

export const buildLocalStaticFilesCache = (
  cacheDir: string,
  name: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
): staticFiles.StaticFilesCache => {
  const createRemoteMap = async (
    cacheName: string
  ): Promise<StaticFilesCacheState> =>
    remoteMapCreator<staticFiles.StaticFilesData>({
      namespace: `staticFilesCache-${cacheName}`,
      serialize: async cacheEntry => safeJsonStringify(cacheEntry),
      deserialize: async data => JSON.parse(data),
      persistent,
    })

  const initCache = async (): Promise<StaticFilesCacheState> => {
    const remoteCache = createRemoteMap(name)
    await migrateLegacyStaticFilesCache(cacheDir, name, await remoteCache)
    return remoteCache
  }

  let cache = initCache()

  return {
    get: async (filepath: string): Promise<staticFiles.StaticFilesData | undefined> => (
      (await cache).get(filepath)
    ),
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
    clone: () => (
      buildLocalStaticFilesCache(cacheDir, name, remoteMapCreator, persistent)
    ),
    list: async () => (
      awu((await cache).keys()).toArray()
    ),
  }
}
