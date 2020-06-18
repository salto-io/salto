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
import path from 'path'
import { readTextFile, exists, mkdirp, replaceContents, rm, rename } from '@salto-io/file'
import { StaticFilesCache, StaticFilesCacheResult } from '@salto-io/workspace'

export const CACHE_FILENAME = 'static-file-cache'

export type StaticFilesCacheState = Record<string, StaticFilesCacheResult>

export const buildLocalStaticFilesCache = (
  cacheDir: string,
  initCacheState?: Promise<StaticFilesCacheState>,
): StaticFilesCache => {
  let currentCacheFile = path.join(cacheDir, CACHE_FILENAME)

  const initCache = async (): Promise<StaticFilesCacheState> =>
    (!(await exists(currentCacheFile)) ? {} : JSON.parse(await readTextFile(currentCacheFile)))

  const cache: Promise<StaticFilesCacheState> = initCacheState || initCache()

  return {
    get: async (filepath: string): Promise<StaticFilesCacheResult> => (
      (await cache)[filepath]
    ),
    put: async (item: StaticFilesCacheResult): Promise<void> => {
      (await cache)[item.filepath] = item
    },
    flush: async () => {
      if (!await exists(cacheDir)) {
        await mkdirp(cacheDir)
      }
      replaceContents(currentCacheFile, JSON.stringify((await cache)))
    },
    clear: async () => {
      await rm(currentCacheFile)
    },
    rename: async (name: string) => {
      const newCacheFile = path.join(path.dirname(cacheDir), name, CACHE_FILENAME)
      if (await exists(currentCacheFile)) {
        await rename(currentCacheFile, newCacheFile)
      }
      currentCacheFile = newCacheFile
    },
    clone: () => buildLocalStaticFilesCache(cacheDir, cache),
  }
}
