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
  buffer?: ContentType
}

export type ParseResultCache = AsyncCache<ParseResultKey, ParseResult> & {
  flush: () => Promise<void>
  clone: () => ParseResultCache
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
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
  const resolveCacheFileName = (key: ParseResultKey): string =>
    _.replace(key.filename, /.nacl$/, CACHE_EXTENSION)

  return {
    put: async (key: Required<ParseResultKey>, value: ParseResult): Promise<void> => {
      dirStore.set({
        filename: resolveCacheFileName(key),
        buffer: parseResultSerializer.serialize({ ...value,
          metadata: { md5: hash.toMD5(key.buffer) } }),
      })
    },

    get: async (key: ParseResultKey): Promise<ParseResult | undefined> => {
      const cacheFileName = resolveCacheFileName(key)
      try {
        const file = await dirStore.get(cacheFileName)

        if (file === undefined) {
          return undefined
        }

        if (doesBufferMatchCachedMD5(key.buffer, file.buffer)) {
          return await parseResultSerializer.deserialize(
            file.buffer,
            val => staticFilesSource.getStaticFile(val.filepath, val.encoding)
          )
        }
      } catch (err) {
        log.debug('Failed to handle cache file "%o": %o', cacheFileName, err)
      }
      return undefined
    },
    clear: dirStore.clear,
    rename: dirStore.rename,
    flush: dirStore.flush,
    clone: (): ParseResultCache => parseResultCache(dirStore.clone(), staticFilesSource.clone()),
  }
}
