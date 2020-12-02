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
import { StaticFile, StaticFileParameters } from '@salto-io/adapter-api'

import { SyncDirectoryStore } from '../dir_store'
import { StaticFilesCache } from './cache'

import {
  InvalidStaticFile, StaticFilesSource, MissingStaticFile, AccessDeniedStaticFile,
} from './common'

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
  const staticFilesSource: StaticFilesSource = {
    getStaticFile: async (
      filepath: string,
      encoding: BufferEncoding,
    ): Promise<StaticFile | InvalidStaticFile> => {
      const cachedResult = await staticFilesCache.get(filepath)
      let modified: number | undefined
      try {
        modified = await staticFilesDirStore.mtimestamp(filepath)
      } catch (err) {
        return new AccessDeniedStaticFile(filepath)
      }
      if (modified === undefined) {
        return new MissingStaticFile(filepath)
      }

      const hashModified = cachedResult ? cachedResult.modified : undefined

      if (hashModified === undefined
        || modified > hashModified
        || cachedResult === undefined) {
        const file = await staticFilesDirStore.get(filepath)
        if (file === undefined) {
          return new MissingStaticFile(filepath)
        }
        const staticFileBuffer = file.buffer
        const staticFileWithHashAndContent = new AbsoluteStaticFile({ filepath,
          content: staticFileBuffer,
          encoding },
        staticFilesDirStore)
        await staticFilesCache.put({
          hash: staticFileWithHashAndContent.hash,
          modified,
          filepath,
        })
        return staticFileWithHashAndContent
      }
      return new LazyStaticFile(
        filepath,
        cachedResult.hash,
        staticFilesDirStore,
        encoding,
      )
    },
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
  }
  return staticFilesSource
}
