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
import { join, basename } from 'path'

import { StaticFile } from '@salto-io/adapter-api'
import { hash as hashUtils } from '@salto-io/lowerdash'

import { DirectoryStore } from '../dir_store'
import { StaticFilesCache } from './cache'
import { StaticFileMetaData, StaticFileNaclValue, InvalidStaticFile } from './common'

export const STATIC_RESOURCES_FOLDER = 'static-resources'


export type StaticFilesSource = {
  getMetaData: (staticFile: StaticFileNaclValue) =>
    Promise<StaticFileMetaData | InvalidStaticFile>
  getStaticFile: (metadata: StaticFileMetaData) => Promise<StaticFile| undefined>
  flush: () => Promise<void>
  clear: () => Promise<void>
  clone: () => StaticFilesSource
}

export const buildStaticFilesSource = (
  staticFilesDirStore: DirectoryStore,
  staticFilesCache: StaticFilesCache,
): StaticFilesSource => {
  const getMetaData = async (
    staticFile: StaticFileNaclValue,
  ): Promise<StaticFileMetaData | InvalidStaticFile> => {
    const cachedResult = await staticFilesCache.get(staticFile.filepath)
    const filepath = join(STATIC_RESOURCES_FOLDER, staticFile.filepath)
    const modified = await staticFilesDirStore.mtimestamp(filepath)
    if (modified === undefined) {
      return new InvalidStaticFile(staticFile.filepath)
    }

    const hashModified = cachedResult ? cachedResult.modified : undefined

    if (hashModified === undefined
      || modified > hashModified
      || cachedResult === undefined) {
      const file = await staticFilesDirStore.get(filepath)
      if (file === undefined) {
        return new InvalidStaticFile(staticFile.filepath)
      }

      const hash = hashUtils.toMD5(Buffer.from(file.buffer))
      const staticFileMetaDataWithHash = new StaticFileMetaData(
        staticFile.filepath,
        hash,
        modified,
      )
      await staticFilesCache.put(staticFileMetaDataWithHash)
      return staticFileMetaDataWithHash
    }

    return cachedResult
  }

  return {
    getMetaData,
    getStaticFile: async (
      metadata: StaticFileMetaData
    ): Promise<StaticFile | undefined> => {
      const file = await staticFilesDirStore.get(metadata.filepath)
      if (file === undefined) {
        return undefined
      }
      return new StaticFile(basename(metadata.filepath), Buffer.from(file.buffer))
    },
    flush: async () => {
      await staticFilesDirStore.flush()
      await staticFilesCache.flush()
    },
    clear: async () => {
      await staticFilesDirStore.clear()
      await staticFilesCache.clear()
    },
    clone: (): StaticFilesSource => buildStaticFilesSource(
      staticFilesDirStore.clone(),
      staticFilesCache.clone(),
    ),
  } as StaticFilesSource
}
