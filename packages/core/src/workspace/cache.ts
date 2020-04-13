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
import { ParseResult } from '../parser/parse'
import * as parseResultSerializer from '../serializer/parse_result'
import { DirectoryStore } from './dir_store'

const log = logger(module)

const CACHE_EXTENSION = '.json'

type AsyncCache<K, V> = {
  get(key: K): Promise<V | undefined>
  put(key: K, value: V): Promise<void>
}

export type ParseResultKey = {
  filename: string
  lastModified: number
}

export type ParseResultCache = AsyncCache<ParseResultKey, ParseResult> &
{ flush: () => Promise<void>; clone: () => ParseResultCache }

export const parseResultCache = (dirStore: DirectoryStore): ParseResultCache => {
  const resolveCacheFileName = (key: ParseResultKey): string =>
    _.replace(key.filename, /.nacl$/, CACHE_EXTENSION)

  return {
    put: async (key: ParseResultKey, value: ParseResult): Promise<void> =>
      dirStore.set({
        filename: resolveCacheFileName(key),
        buffer: parseResultSerializer.serialize(value),
      }),

    get: async (key: ParseResultKey): Promise<ParseResult | undefined> => {
      const cacheFileName = resolveCacheFileName(key)
      const cacheTimeMs = await dirStore.mtimestamp(cacheFileName) || -1
      if ((cacheTimeMs > key.lastModified) || (cacheTimeMs === key.lastModified)) {
        const fileContent = (await dirStore.get(cacheFileName))?.buffer
        try {
          return _.isUndefined(fileContent)
            ? Promise.resolve(undefined)
            : parseResultSerializer.deserialize(fileContent)
        } catch (err) {
          log.debug('Failed to handle cache file "%o": %o', cacheFileName, err)
        }
      }
      return Promise.resolve(undefined)
    },

    flush: dirStore.flush,
    clone: (): ParseResultCache => parseResultCache(dirStore.clone()),
  }
}
