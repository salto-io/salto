/*
*                      Copyright 2022 Salto Labs Ltd.
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

const log = logger(module)

type StaticFilesCacheState = remoteMap.RemoteMap<staticFiles.StaticFilesCacheResult>

export const buildLocalStaticFilesCache = (
  baseDir: string,
  name: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
): staticFiles.StaticFilesCache => {
  const createRemoteMap = async (
    cacheName: string
  ): Promise<StaticFilesCacheState> =>
    remoteMapCreator<staticFiles.StaticFilesCacheResult>({
      namespace: `staticFilesCache-${cacheName}`,
      serialize: staticFile => safeJsonStringify(staticFile),
      deserialize: async data => JSON.parse(data),
      persistent: true,
    })

  const migrateLegacyStaticFilesCache = async (
    remoteCache: StaticFilesCacheState
  ): Promise<void> => {
    const CACHE_FILENAME = 'static-file-cache'
    const currentCacheFile = path.join(baseDir, name, CACHE_FILENAME)

    if (await exists(currentCacheFile)) {
      if (remoteCache.isEmpty()) {
        log.debug('migrating legacy static files cache from file: %s', currentCacheFile)
        const oldCache: Record<string, staticFiles.StaticFilesCacheResult> = JSON.parse(
          await readTextFile(currentCacheFile)
        )
        await remoteCache.setAll(
          Object.values(oldCache).map(item => ({ value: item, key: item.filepath }))
        )
        await remoteCache.flush()
      } else {
        log.debug('found legacy static files cache, but static files cache is not empty')
      }
      log.debug('deleting legacy static files cache file: %s', currentCacheFile)
      await rm(currentCacheFile)
    }
  }

  const initCache = async (): Promise<StaticFilesCacheState> => {
    const remoteCache = createRemoteMap(name)
    await migrateLegacyStaticFilesCache(await remoteCache)
    return remoteCache
  }

  let cache = initCache()

  return {
    get: async (filepath: string): Promise<staticFiles.StaticFilesCacheResult | undefined> => (
      (await cache).get(filepath)
    ),
    put: async (item: staticFiles.StaticFilesCacheResult): Promise<void> => {
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
      buildLocalStaticFilesCache(baseDir, name, remoteMapCreator)
    ),
  }
}
