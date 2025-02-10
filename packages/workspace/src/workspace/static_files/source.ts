/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { StaticFile, StaticFileParameters, calculateStaticFileHash } from '@salto-io/adapter-api'

import wu from 'wu'
import { values, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { StaticFilesCache, StaticFilesData } from './cache'
import { DirectoryStore, FlushResult } from '../dir_store'

import { InvalidStaticFile, StaticFilesSource, MissingStaticFile, AccessDeniedStaticFile } from './common'
import { getSaltoFlagBool, WORKSPACE_FLAGS } from '../../flags'

const log = logger(module)

const { withLimitedConcurrency } = promises.array

// TODO: this should moved into cache implementation
const CACHE_READ_CONCURRENCY = 100

class StaticFileAccessDeniedError extends Error {
  constructor(filepath: string, reason: string) {
    super(`access denied for ${filepath}: ${reason}`)
  }
}

class MissingStaticFileError extends Error {
  constructor(filepath: string, source: string) {
    super(`missing static file ${filepath} from ${source}`)
  }
}

export class AbsoluteStaticFile extends StaticFile {
  readonly absoluteFilePath: string

  constructor(
    params: StaticFileParameters & {
      absoluteFilePath: string
    },
  ) {
    super(params)
    this.absoluteFilePath = params.absoluteFilePath
  }
}

export class LazyStaticFile extends AbsoluteStaticFile {
  private resolvedContent: Promise<Buffer | undefined> | undefined

  constructor(
    filepath: string,
    hash: string,
    absoluteFilePath: string,
    private getContentFunc: () => Promise<Buffer | undefined>,
    encoding?: BufferEncoding,
    isTemplate?: boolean,
  ) {
    super({ filepath, hash, encoding, absoluteFilePath, isTemplate })
  }

  async getContent(): Promise<Buffer | undefined> {
    if (this.resolvedContent === undefined) {
      this.resolvedContent = this.getContentFunc()
    }
    return this.resolvedContent
  }
}

export class PlaceholderStaticFile extends StaticFile {}

export const buildStaticFilesSource = (
  staticFilesDirStore: DirectoryStore<Buffer>,
  staticFilesCache: StaticFilesCache,
  ignoreFileChanges = false,
): Required<StaticFilesSource> => {
  const getStaticFileData = async (
    filepath: string,
  ): Promise<{ hasChanged: boolean; buffer?: Buffer } & StaticFilesData> => {
    const cachedResult = await staticFilesCache.get(filepath)
    let modified: number | undefined
    if (ignoreFileChanges) {
      if (cachedResult === undefined) {
        throw new MissingStaticFileError(filepath, 'static files cache')
      }
      return {
        ...cachedResult,
        hasChanged: false,
      }
    }

    try {
      modified = await staticFilesDirStore.mtimestamp(filepath)
    } catch (error) {
      throw new StaticFileAccessDeniedError(filepath, error.message)
    }
    if (modified === undefined) {
      throw new MissingStaticFileError(filepath, 'static files dir store (mtimestamp)')
    }

    const cacheModified = cachedResult ? cachedResult.modified : undefined

    if (cachedResult === undefined || cacheModified === undefined || modified > cacheModified) {
      const file = await staticFilesDirStore.get(filepath)
      if (file === undefined) {
        throw new MissingStaticFileError(filepath, 'static files dir store')
      }
      const staticFileBuffer = file.buffer
      const hash = calculateStaticFileHash(staticFileBuffer)
      await staticFilesCache.put({
        hash,
        modified,
        filepath,
      })
      return {
        filepath,
        hash,
        modified,
        buffer: staticFileBuffer,
        hasChanged: hash !== cachedResult?.hash,
      }
    }
    return {
      ...cachedResult,
      hasChanged: false,
    }
  }

  const updateCacheWithFlushResult = async (flushResult: FlushResult<Buffer>): Promise<void> => {
    const { updates, deletions } = flushResult
    const cacheUpdates = updates.flatMap(file => {
      if (file.timestamp === undefined) {
        log.warn('received undefined timestamp for file %s', file.filename)
        return []
      }
      return {
        filepath: file.filename,
        hash: calculateStaticFileHash(file.buffer),
        modified: file.timestamp,
      }
    })
    await staticFilesCache.deleteMany(deletions)
    await staticFilesCache.putMany(cacheUpdates)
  }

  const staticFilesSource: Required<StaticFilesSource> = {
    load: async () => {
      const existingFiles = new Set(await staticFilesDirStore.list())
      const cachedFileNames = new Set(await staticFilesCache.list())
      const newFiles = wu(existingFiles.keys())
        .filter(name => !cachedFileNames.has(name))
        .toArray()
      const deletedFiles = wu(cachedFileNames.keys())
        .filter(name => !existingFiles.has(name))
        .toArray()

      if (deletedFiles.length > 0) {
        log.debug('deleting %d files from static files cache', deletedFiles.length)
        await staticFilesCache.deleteMany(deletedFiles)
      }

      const modifiedFilesSet = new Set(
        (
          await withLimitedConcurrency(
            wu(existingFiles.keys())
              .filter(name => cachedFileNames.has(name))
              .map(name => async () => ((await getStaticFileData(name)).hasChanged ? name : undefined)),
            CACHE_READ_CONCURRENCY,
          )
        ).filter(values.isDefined),
      )

      return [...newFiles, ...deletedFiles, ...modifiedFilesSet.keys()]
    },
    getStaticFile: async (args: {
      filepath: string
      encoding: BufferEncoding
      hash?: string
      isTemplate?: boolean
    }): Promise<StaticFile | InvalidStaticFile> => {
      try {
        const staticFileData = await getStaticFileData(args.filepath)
        if (args.hash !== undefined && staticFileData.hash !== args.hash) {
          // We return a PlaceholderStaticFile in this case and not a MissingStaticFile to be able to differ
          // in the elements cache between a file that was really missing when the cache was
          // written, and a file that existed but was modified since the cache was written,
          // as the latter should not be represented in the element that is returned from
          // the cache as MissingStaticFile
          return new PlaceholderStaticFile({
            filepath: args.filepath,
            encoding: args.encoding,
            hash: args.hash,
            isTemplate: args.isTemplate,
          })
        }

        if (staticFileData.buffer !== undefined) {
          const staticFileWithHashAndContent = new AbsoluteStaticFile({
            filepath: args.filepath,
            content: staticFileData.buffer,
            encoding: args.encoding,
            absoluteFilePath: staticFilesDirStore.getFullPath(args.filepath),
            isTemplate: args.isTemplate,
          })
          return staticFileWithHashAndContent
        }
        return new LazyStaticFile(
          args.filepath,
          staticFileData.hash,
          staticFilesDirStore.getFullPath(args.filepath),
          // We use ignoreDeletionsCache to make sure that if the file was requested and then the content
          // was deleted, we will still lbe able to access the content
          async () => {
            const file = await staticFilesDirStore.get(args.filepath, { ignoreDeletionsCache: true })
            if (file === undefined) {
              log.warn('file %s is missing from static files dir store', args.filepath)
              return undefined
            }
            if (file.buffer === undefined) {
              log.warn('received file %s without buffer from static files dir store', args.filepath)
            }
            return file.buffer
          },
          args.encoding,
          args.isTemplate,
        )
      } catch (e) {
        if (args.hash !== undefined) {
          // We return a PlaceholderStaticFile in this case and not a MissingStaticFile to be able to differ
          // in the elements cache between a file that was really missing when the cache was
          // written, and a file that existed but was removed since the cache was written,
          // as the latter should not be represented in the element that is returned from
          // the cache as MissingStaticFile
          return new PlaceholderStaticFile({
            filepath: args.filepath,
            encoding: args.encoding,
            hash: args.hash,
            isTemplate: args.isTemplate,
          })
        }

        log.debug('failed to get file %s (hash: %s) with error: %o', args.filepath, args.hash, e)
        if (e instanceof MissingStaticFileError) {
          return new MissingStaticFile(args.filepath)
        }
        if (e instanceof StaticFileAccessDeniedError) {
          return new AccessDeniedStaticFile(args.filepath)
        }
        throw e
      }
    },
    getContent: async (filepath: string): Promise<Buffer> => {
      const file = await staticFilesDirStore.get(filepath)
      if (file === undefined) {
        throw new Error(`Missing content on static file: ${filepath}`)
      }
      return file.buffer
    },
    persistStaticFile: async (staticFile: StaticFile): Promise<void> => {
      const buffer = await staticFile.getContent()
      if (buffer === undefined) {
        log.warn(`Missing content on static file: ${staticFile.filepath}`)
        return undefined
      }
      return staticFilesDirStore.set({ filename: staticFile.filepath, buffer })
    },
    flush: async () => {
      const skipStaticFilesCacheUpdate = getSaltoFlagBool(WORKSPACE_FLAGS.skipStaticFilesCacheUpdate)
      const flushResult = await staticFilesDirStore.flush(!skipStaticFilesCacheUpdate)
      if (flushResult !== undefined) {
        await updateCacheWithFlushResult(flushResult)
      } else {
        log.info('skipping static files cache update from dirStore flush')
      }
      await staticFilesCache.flush()
    },
    clear: async () => {
      await staticFilesDirStore.clear()
      await staticFilesCache.clear()
    },
    rename: async (name: string) => {
      await staticFilesDirStore.rename(name)
      await staticFilesCache.rename(name)
    },
    getTotalSize: staticFilesDirStore.getTotalSize,
    clone: (): StaticFilesSource => buildStaticFilesSource(staticFilesDirStore.clone(), staticFilesCache.clone()),
    delete: async (staticFile: StaticFile): Promise<void> => staticFilesDirStore.delete(staticFile.filepath),
    isPathIncluded: filePath => staticFilesDirStore.isPathIncluded(filePath),
  }
  return staticFilesSource
}

export const buildInMemStaticFilesSource = (files: Map<string, StaticFile> = new Map()): StaticFilesSource => ({
  load: async () => [],
  getStaticFile: async args => files.get(args.filepath) ?? new MissingStaticFile(args.filepath),
  persistStaticFile: async file => {
    files.set(file.filepath, file)
  },
  getContent: async filepath => {
    const file = files.get(filepath)
    const content = await file?.getContent()
    if (content === undefined) {
      throw new Error(`Missing content on static file: ${filepath}`)
    }
    return content
  },
  clear: async () => {
    files.clear()
  },
  clone: () => buildInMemStaticFilesSource(new Map(files.entries())),
  delete: async file => {
    files.delete(file.filepath)
  },
  flush: () => Promise.resolve(),
  getTotalSize: async () => 0,
  isPathIncluded: () => true,
  rename: () => Promise.resolve(),
})
