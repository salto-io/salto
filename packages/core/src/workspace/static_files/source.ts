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
import { StaticFile } from '@salto-io/adapter-api'

import { DirectoryStore } from '../dir_store'
import { StaticFilesCache } from './cache'

import {
  InvalidStaticFile, StaticFilesSource, MissingStaticFile, AccessDeniedStaticFile,
} from './common'

export const buildStaticFilesSource = (
  staticFilesDirStore: DirectoryStore,
  staticFilesCache: StaticFilesCache,
): StaticFilesSource => {
  const staticFilesSource: StaticFilesSource = {
    getStaticFile: async (
      filepath: string,
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

        const staticFileBuffer = Buffer.from(file.buffer)
        const staticFileWithHashAndContent = new StaticFile({
          filepath,
          content: staticFileBuffer,
        })
        await staticFilesCache.put({
          hash: staticFileWithHashAndContent.hash,
          modified,
          filepath,
        })
        return staticFileWithHashAndContent
      }

      return new StaticFile({
        filepath,
        hash: cachedResult.hash,
      })
    },
    getContent: async (
      filepath: string
    ): Promise<Buffer> => {
      const file = await staticFilesDirStore.get(filepath)
      if (file === undefined) {
        throw new Error(`Missing content on static file: ${filepath}`)
      }
      return Buffer.from(file.buffer)
    },
    persistStaticFile: async (
      staticFile: StaticFile,
    ): Promise<void> => {
      if (staticFile.content === undefined) {
        throw new Error(`Missing content on static file: ${staticFile.filepath}`)
      }
      return staticFilesDirStore.set({
        filename: staticFile.filepath,
        buffer: staticFile.content.toString(),
      })
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
      staticFilesDirStore.clone(),
      staticFilesCache.clone(),
    ),
  }
  return staticFilesSource
}
