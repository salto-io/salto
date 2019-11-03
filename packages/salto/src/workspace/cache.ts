import _ from 'lodash'
import * as fs from 'async-file'
import path from 'path'

import { logger } from '@salto/logging'
import { ParseResult } from '../parser/parse'
import * as parseResultSerializer from '../serializer/parse_result'

const log = logger(module)

const EXTERNAL_BP_CACHE_DIR = 'external_bp'
const CACHE_FOLDER = '.cache'
export interface AsyncCache<K, V> {
    get(key: K): Promise<V | undefined>
    put(key: K, value: V): Promise<void>
}

export type ParseResultKey = {
  filename: string
  lastModified: number
}

export type ParseResultCache = AsyncCache<ParseResultKey, ParseResult>
export class ParseResultFSCache implements ParseResultCache {
      private baseCacheDir: string
      private baseWorkspaceDir: string

      constructor(localStorageDir: string, baseWorkspaceDir: string) {
        this.baseCacheDir = path.join(localStorageDir, CACHE_FOLDER)
        this.baseWorkspaceDir = baseWorkspaceDir
      }

      private resolveCacheFilePath = (key: ParseResultKey): string => {
        // First, we normalize the filename to be relative to the workspace
        // We need to do this to support external BP in both abs and rel notation
        const normFilename = path.isAbsolute(key.filename)
          ? path.relative(this.baseWorkspaceDir, key.filename)
          : key.filename
        const cacheFileName = normFilename.startsWith('..') // Indicates that the file is external
          ? path.join(EXTERNAL_BP_CACHE_DIR, path.resolve(this.baseWorkspaceDir, normFilename))
          : normFilename
        return path.join(this.baseCacheDir, _.replace(cacheFileName, /.bp$/, '.bpc'))
      }

      async put(key: ParseResultKey, value: ParseResult): Promise<void> {
        const filePath = this.resolveCacheFilePath(key)
        await fs.createDirectory(path.parse(filePath).dir)
        return fs.writeFile(filePath, parseResultSerializer.serialize(value))
      }

      async get(key: ParseResultKey): Promise<ParseResult | undefined> {
        const cacheFilePath = this.resolveCacheFilePath(key)
        if (await fs.exists(cacheFilePath)
          && (await fs.stat(cacheFilePath)).mtimeMs > key.lastModified) {
          const fileContent = await fs.readFile(cacheFilePath, 'utf8')
          try {
            return parseResultSerializer.deserialize(fileContent)
          } catch (err) {
            log.debug('Failed to handle cache file "%o": %o', cacheFilePath, err)
          }
        }
        return Promise.resolve(undefined)
      }
}
