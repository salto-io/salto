import _ from 'lodash'
import * as fs from 'async-file'
import path from 'path'

import { ParseResult } from '../parser/parse'
import * as parseResultSerializer from '../serializer/parse_result'


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
      private baseDir: string

      constructor(baseDir: string) {
        this.baseDir = baseDir
      }

      private resolveCacheFilePath = (key: ParseResultKey): string =>
        path.join(this.baseDir, _.replace(key.filename, /.bp$/, '.bpc'))

      async put(key: ParseResultKey, value: ParseResult): Promise<void> {
        const filePath = this.resolveCacheFilePath(key)
        await fs.createDirectory(path.parse(filePath).dir)
        return fs.writeFile(filePath, parseResultSerializer.serialize(value))
      }

      async get(key: ParseResultKey): Promise<ParseResult | undefined> {
        const cacheFilePath = this.resolveCacheFilePath(key)
        if (await fs.exists(cacheFilePath)
          && (await fs.stat(cacheFilePath)).mtimeMs > key.lastModified) {
          return parseResultSerializer.deserialize((await fs.readFile(cacheFilePath, 'utf8')) as string)
        }
        return Promise.resolve(undefined)
      }
}
