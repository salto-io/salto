/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { staticFiles } from '@salto-io/workspace'
import { safeJsonStringify } from '@salto-io/adapter-utils'

export const CACHE_FILENAME = 'static-file-cache'

export type StaticFilesCacheState = Record<string, staticFiles.StaticFilesCacheResult>

export const buildLocalStaticFilesCache = (
  baseDir: string,
  name: string,
  initCacheState?: Promise<StaticFilesCacheState>,
): staticFiles.StaticFilesCache => {
  let currentName = name
  let cacheDir = path.join(baseDir, currentName)
  let currentCacheFile = path.join(cacheDir, CACHE_FILENAME)

  const initCache = async (): Promise<StaticFilesCacheState> =>
    (!(await exists(currentCacheFile)) ? {} : JSON.parse(await readTextFile(currentCacheFile)))

  let cache: Promise<StaticFilesCacheState> = initCacheState || initCache()

  return {
    get: async (filepath: string): Promise<staticFiles.StaticFilesCacheResult> => (
      (await cache)[filepath]
    ),
    put: async (item: staticFiles.StaticFilesCacheResult): Promise<void> => {
      (await cache)[item.filepath] = item
    },
    flush: async () => {
      if (!await exists(cacheDir)) {
        await mkdirp(cacheDir)
      }
      await replaceContents(currentCacheFile, safeJsonStringify((await cache)))
    },
    clear: async () => {
      await rm(currentCacheFile)
      cache = Promise.resolve({})
    },
    rename: async (newName: string) => {
      const newCacheDir = path.join(baseDir, newName)
      const newCacheFile = path.join(newCacheDir, CACHE_FILENAME)
      if (await exists(currentCacheFile)) {
        await mkdirp(newCacheDir)
        await rename(currentCacheFile, newCacheFile)
      }
      currentName = newName
      currentCacheFile = newCacheFile
      cacheDir = newCacheDir
    },
    clone: () => buildLocalStaticFilesCache(cacheDir, currentName, cache),
  }
}
