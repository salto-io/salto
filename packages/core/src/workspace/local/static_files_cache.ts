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
import { readTextFile, exists, mkdirp, replaceContents } from '@salto-io/file'
import { StaticFileMetaData } from '../static_files/common'
import { StaticFilesCache } from '../static_files/cache'

export const CACHE_FILENAME = 'static-file-cache'

export type StaticFilesCacheState = Record<string, StaticFileMetaData>

export const buildLocalStaticFilesCache = (
  cacheDir: string,
  initCacheState?: Promise<StaticFilesCacheState>,
): StaticFilesCache => {
  const cacheFile = path.join(cacheDir, CACHE_FILENAME)

  const initCache = async (): Promise<StaticFilesCacheState> =>
    (!(await exists(cacheFile)) ? {} : JSON.parse(await readTextFile(cacheFile)))

  const cache: Promise<StaticFilesCacheState> = initCacheState || initCache()

  return {
    get: async (filepath: string): Promise<StaticFileMetaData> => (
      (await cache)[filepath]
    ),
    put: async (item: StaticFileMetaData): Promise<void> => {
      (await cache)[item.filepath] = {
        ...item,
        ...{
          modified: item.modified || new Date().getTime(),
        },
      }
    },
    flush: async () => {
      if (!await exists(cacheDir)) {
        await mkdirp(cacheDir)
      }
      replaceContents(cacheFile, JSON.stringify((await cache)))
    },
    clone: () => buildLocalStaticFilesCache(cacheDir, cache),
  }
}
