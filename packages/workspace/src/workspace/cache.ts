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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { hash } from '@salto-io/lowerdash'
import { ParseResult } from '../parser'
import * as parseResultSerializer from '../serializer/parse_result'
import { ContentType, DirectoryStore } from './dir_store'
import { StaticFilesSource } from './static_files'

const log = logger(module)

const CACHE_EXTENSION = '.jsonl'

type AsyncCache<K, V> = {
  get(key: K): Promise<V | undefined>
  put(key: K, value: V): Promise<void>
}

export type ParseResultKey = {
  filename: string
  lastModified: number
  buffer?: ContentType
}

export type ParseResultCache = AsyncCache<ParseResultKey, ParseResult> & {
  flush: () => Promise<void>
  clone: () => ParseResultCache
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
  list: () => Promise<string[]>
  delete: (filename: string) => Promise<void>
  get(key: ParseResultKey, allowInvalid: boolean): Promise<ParseResult | undefined>
}

const doesBufferMatchCachedMD5 = (buffer: ContentType | undefined,
  serializedResult: string): boolean => {
  if (_.isUndefined(buffer)) {
    return false
  }
  const metadata = parseResultSerializer.deserializeMetadata(serializedResult)
  if (_.isUndefined(metadata)) {
    return false
  }
  return hash.toMD5(buffer) === metadata.md5
}
export const parseResultCache = (
  dirStore: DirectoryStore<string>, staticFilesSource: StaticFilesSource
): ParseResultCache => {
  const cahceSuffixRegex = new RegExp(`${CACHE_EXTENSION}$`)
  const resolveCacheFileName = (filename: string): string =>
    _.replace(filename, /\.nacl$/, CACHE_EXTENSION)

  const resolveFileName = (filename: string): string => (
    _.replace(filename, cahceSuffixRegex, '.nacl')
  )
  const getCacheData = async (
    key: ParseResultKey,
    allowInvalid = false
  ): Promise<string | undefined> => {
    const cacheFileName = resolveCacheFileName(key.filename)
    const file = await dirStore.get(cacheFileName)
    if (file === undefined) {
      return undefined
    }
    const cacheTimeMs = await dirStore.mtimestamp(cacheFileName) || -1
    if (allowInvalid
        || (cacheTimeMs >= key.lastModified
        || doesBufferMatchCachedMD5(key.buffer, file.buffer)
        )) {
      return file.buffer
    }
    return undefined
  }

  return {
    put: async (key: Required<ParseResultKey>, value: ParseResult): Promise<void> => {
      await dirStore.set({
        filename: resolveCacheFileName(key.filename),
        buffer: await parseResultSerializer.serialize({ ...value,
          metadata: { md5: hash.toMD5(key.buffer) } }),
      })
    },
    get: async (key: ParseResultKey, allowInvalid = false): Promise<ParseResult | undefined> => {
      try {
        const validCacheBuffer = await getCacheData(key, allowInvalid)
        if (validCacheBuffer !== undefined) {
          // We await on deserialize instead of just returning it so we can catch the error.
          const res = await parseResultSerializer.deserialize(
            validCacheBuffer,
            val => staticFilesSource.getStaticFile(val.filepath, val.encoding)
          )
          return res
        }
      } catch (err) {
        log.debug('Failed to handle cache file "%o": %o', resolveCacheFileName(key.filename), err)
      }
      return undefined
    },
    delete: async (filename: string): Promise<void> => {
      const cacheFilename = resolveCacheFileName(filename)
      await dirStore.delete(cacheFilename)
    },
    list: async () => (await dirStore.list()).map(resolveFileName),
    clear: dirStore.clear,
    rename: dirStore.rename,
    flush: dirStore.flush,
    clone: (): ParseResultCache => parseResultCache(dirStore.clone(), staticFilesSource.clone()),

  }
}
