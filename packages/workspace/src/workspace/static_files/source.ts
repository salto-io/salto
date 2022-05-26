/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { StaticFile, StaticFileParameters, calculateStaticFileHash } from '@salto-io/adapter-api'

import wu from 'wu'
import { values, promises } from '@salto-io/lowerdash'
import { SyncDirectoryStore } from '../dir_store'
import { StaticFilesCache, StaticFilesData } from './cache'

import {
  InvalidStaticFile, StaticFilesSource, MissingStaticFile, AccessDeniedStaticFile,
} from './common'

const { withLimitedConcurrency } = promises.array

class StaticFileAccessDeniedError extends Error {
  constructor(filepath: string) {
    super(`access denied for ${filepath}`)
  }
}

class MissingStaticFileError extends Error {
  constructor(filepath: string) {
    super(`missing static file ${filepath}`)
  }
}

export class AbsoluteStaticFile extends StaticFile {
  protected dirStore: SyncDirectoryStore<Buffer>

  constructor(
    params: StaticFileParameters,
    dirStore: SyncDirectoryStore<Buffer>,
  ) {
    super(params)
    this.dirStore = dirStore
  }

  get absoluteFilePath(): string {
    return this.dirStore.getFullPath(this.filepath)
  }
}

export class LazyStaticFile extends AbsoluteStaticFile {
  constructor(
    filepath: string,
    hash: string,
    dirStore: SyncDirectoryStore<Buffer>,
    encoding?: BufferEncoding
  ) {
    super({ filepath, hash, encoding }, dirStore)
  }

  get content(): Buffer | undefined {
    if (this.internalContent === undefined) {
      this.internalContent = this.dirStore.getSync(this.filepath)?.buffer
    }
    return this.internalContent
  }

  async getContent(): Promise<Buffer | undefined> {
    if (this.internalContent === undefined) {
      this.internalContent = (await this.dirStore.get(this.filepath))?.buffer
    }
    return this.internalContent
  }
}

export const buildStaticFilesSource = (
  staticFilesDirStore: SyncDirectoryStore<Buffer>,
  staticFilesCache: StaticFilesCache,
): StaticFilesSource => {
  const getStaticFileData = async (filepath: string): Promise<
    ({ hasChanged: false } | { hasChanged: true; buffer: Buffer}) & StaticFilesData
  > => {
    const cachedResult = await staticFilesCache.get(filepath)
    let modified: number | undefined
    try {
      modified = await staticFilesDirStore.mtimestamp(filepath)
    } catch (err) {
      throw new StaticFileAccessDeniedError(filepath)
    }
    if (modified === undefined) {
      throw new MissingStaticFileError(filepath)
    }

    const cacheModified = cachedResult ? cachedResult.modified : undefined

    if (cachedResult === undefined
        || cacheModified === undefined
        || modified > cacheModified) {
      const file = await staticFilesDirStore.get(filepath)
      if (file === undefined) {
        throw new MissingStaticFileError(filepath)
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
        hasChanged: true,
      }
    }
    return {
      ...cachedResult,
      hasChanged: false,
    }
  }

  const getStaticFile = async (
    filepath: string,
    encoding: BufferEncoding,
  ): Promise<StaticFile | InvalidStaticFile> => {
    try {
      const staticFileData = await getStaticFileData(filepath)

      if (staticFileData.hasChanged) {
        const staticFileWithHashAndContent = new AbsoluteStaticFile({ filepath,
          content: staticFileData.buffer,
          encoding },
        staticFilesDirStore)
        return staticFileWithHashAndContent
      }
      return new LazyStaticFile(
        filepath,
        staticFileData.hash,
        staticFilesDirStore,
        encoding,
      )
    } catch (e) {
      if (e instanceof MissingStaticFileError) {
        return new MissingStaticFile(filepath)
      }
      if (e instanceof StaticFileAccessDeniedError) {
        return new AccessDeniedStaticFile(filepath)
      }
      throw e
    }
  }

  const staticFilesSource: StaticFilesSource = {
    load: async (): Promise<string[]> => {
      const existingFiles = new Set(await staticFilesDirStore.list())
      const cachedFileNames = new Set(await staticFilesCache.list())
      const newFiles = wu(existingFiles.keys())
        .filter(name => !cachedFileNames.has(name))
        .toArray()
      const deletedFiles = wu(cachedFileNames.keys())
        .filter(name => !existingFiles.has(name))
        .toArray()

      const modifiedFilesSet = new Set((await withLimitedConcurrency(
        wu(existingFiles.keys())
          .filter(name => cachedFileNames.has(name))
          .map(name => async () => ((await getStaticFileData(name)).hasChanged ? name : undefined)),
        500
      )).filter(values.isDefined))

      return [
        ...newFiles,
        ...deletedFiles,
        ...modifiedFilesSet.keys(),
      ]
    },
    getStaticFile,
    getContent: async (
      filepath: string
    ): Promise<Buffer> => {
      const file = await staticFilesDirStore.get(filepath)
      if (file === undefined) {
        throw new Error(`Missing content on static file: ${filepath}`)
      }
      return file.buffer
    },
    persistStaticFile: async (
      staticFile: StaticFile,
    ): Promise<void> => {
      const buffer = await staticFile.getContent()
      if (buffer === undefined) {
        throw new Error(`Missing content on static file: ${staticFile.filepath}`)
      }
      return staticFilesDirStore.set({ filename: staticFile.filepath, buffer })
    },
    flush: async () => {
      await staticFilesDirStore.flush()
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
    clone: (): StaticFilesSource => buildStaticFilesSource(
      staticFilesDirStore.clone() as SyncDirectoryStore<Buffer>,
      staticFilesCache.clone(),
    ),
    delete: async (staticFile: StaticFile): Promise<void> => (
      staticFilesDirStore.delete(staticFile.filepath)
    ),
    isPathIncluded: filePath => staticFilesSource.isPathIncluded(filePath),
  }
  return staticFilesSource
}
