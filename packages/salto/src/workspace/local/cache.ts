import _ from 'lodash'
import { logger } from '@salto/logging'
import path from 'path'
import * as parseResultSerializer from '../../serializer/parse_result'
import { stat, mkdirp, writeFile, readTextFile } from '../../file'
import { ParseResultCache, ParseResultKey } from '../cache'
import { ParseResult } from '../../parser/parse'

const log = logger(module)

export const localParseResultCache = (cacheDir: string): ParseResultCache => {
  const resolveCacheFilePath = (key: ParseResultKey): string =>
    path.join(cacheDir, _.replace(key.filename, /.bp$/, '.bpc'))

  return {
    put: async (key: ParseResultKey, value: ParseResult): Promise<void> => {
      const filePath = resolveCacheFilePath(key)
      await mkdirp(path.parse(filePath).dir)
      return writeFile(filePath, parseResultSerializer.serialize(value))
    },

    get: async (key: ParseResultKey): Promise<ParseResult | undefined> => {
      const cacheFilePath = resolveCacheFilePath(key)
      const cacheTimeMs = (await stat.notFoundAsUndefined(cacheFilePath))?.mtimeMs || -1
      if ((cacheTimeMs > key.lastModified) || (cacheTimeMs === key.lastModified)) {
        const fileContent = await readTextFile(cacheFilePath)
        try {
          return parseResultSerializer.deserialize(fileContent)
        } catch (err) {
          log.debug('Failed to handle cache file "%o": %o', cacheFilePath, err)
        }
      }
      return Promise.resolve(undefined)
    },
  }
}
