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
import { StaticFileMetaData } from '../static_files/common'
import { StaticFilesCache } from '../static_files/cache'
import { readTextFile, exists, mkdirp, replaceContents } from '../../file'

export const CACHE_FILENAME = 'static-file-cache'

export type StaticFilesCacheState = Record<string, StaticFileMetaData>

export const buildLocalStaticFilesCache = (
  localStorage: string,
  initCacheState?: Promise<StaticFilesCacheState>,
): StaticFilesCache => {
  const cacheDir = path.resolve(path.join(localStorage, 'cache'))
  const cacheFile = path.join(cacheDir, CACHE_FILENAME)

  const initCache = async (): Promise<StaticFilesCacheState> => {
    if (!await exists(cacheDir)) {
      await mkdirp(cacheDir)
    }
    return !(await exists(cacheFile))
      ? {}
      : JSON.parse(await readTextFile(cacheFile))
  }

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
    flush: async () => replaceContents(cacheFile, JSON.stringify((await cache))),
    clone: () => buildLocalStaticFilesCache(localStorage, cache),
  }
}
