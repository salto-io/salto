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
import { collections } from '@salto-io/lowerdash'
import { staticFiles, remoteMap } from '@salto-io/workspace'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

const { awu } = collections.asynciterable

const log = logger(module)

export type StaticFilesCacheState = Record<string, staticFiles.StaticFilesCacheResult>

export const buildLocalStaticFilesCache = (
  baseDir: string,
  name: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
): staticFiles.StaticFilesCache => {
  const createRemoteCache = async (
    cacheName: string
  ): Promise<remoteMap.RemoteMap<staticFiles.StaticFilesCacheResult>> =>
    remoteMapCreator<staticFiles.StaticFilesCacheResult>({
      namespace: `staticFilesCache-${cacheName}`,
      serialize: staticFile => safeJsonStringify(staticFile),
      deserialize: async data => JSON.parse(data),
      persistent: true,
    })

  let remoteCache = createRemoteCache(name)

  const syncRemote = async (sourceCache: StaticFilesCacheState): Promise<void> => {
    await (await remoteCache).setAll(
      Object.values(sourceCache).map(item => ({ value: item, key: item.filepath }))
    )
    await (await remoteCache).flush()
  }

  const migrateLegacyStaticFilesCache = async (): Promise<void> => {
    const CACHE_FILENAME = 'static-file-cache'
    const currentCacheFile = path.join(baseDir, name, CACHE_FILENAME)

    if (await exists(currentCacheFile)) {
      if ((await remoteCache).isEmpty()) {
        log.debug('migrating legacy static files cache from file: %s', currentCacheFile)
        await syncRemote(await JSON.parse(await readTextFile(currentCacheFile)))
      } else {
        log.debug('found legacy static files cache, but static files cache is not empty')
      }
      log.debug('deleting legacy static files cache file: %s', currentCacheFile)
      await rm(currentCacheFile)
    }
  }

  const initCache = async (): Promise<StaticFilesCacheState> => {
    await migrateLegacyStaticFilesCache()
    return Object.fromEntries(
      await awu((await remoteCache).entries())
        .map(e => [e.key, e.value] as [string, staticFiles.StaticFilesCacheResult])
        .toArray()
    )
  }

  let cache: Promise<StaticFilesCacheState> = initCache()

  return {
    get: async (filepath: string): Promise<staticFiles.StaticFilesCacheResult> => (
      (await cache)[filepath]
    ),
    put: async (item: staticFiles.StaticFilesCacheResult): Promise<void> => {
      (await cache)[item.filepath] = item
    },
    flush: async () => {
      await (await remoteCache).clear()
      await syncRemote(await cache)
    },
    clear: async () => {
      await (await remoteCache).clear()
      cache = Promise.resolve({})
    },
    rename: async (newName: string) => {
      const oldRemoteCache = await remoteCache
      remoteCache = createRemoteCache(newName)
      await (await remoteCache).clear()
      await syncRemote(await cache)
      await oldRemoteCache.clear()
    },
  }
}
