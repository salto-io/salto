import _ from 'lodash'
import { logger } from '@salto/logging'
import { ParseResult } from '../parser/parse'
import * as parseResultSerializer from '../serializer/parse_result'
import { DirectoryStore } from './dir_store'

const log = logger(module)

const CACHE_EXTENSION = '.bpc'

type AsyncCache<K, V> = {
  get(key: K): Promise<V | undefined>
  put(key: K, value: V): Promise<void>
}

export type ParseResultKey = {
  filename: string
  lastModified: number
}

export type ParseResultCache = AsyncCache<ParseResultKey, ParseResult> &
{ flush: () => Promise<void> }

export const parseResultCache = (dirStore: DirectoryStore): ParseResultCache => {
  const resolveCacheFileName = (key: ParseResultKey): string =>
    _.replace(key.filename, /.bp$/, CACHE_EXTENSION)

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
  }
}
