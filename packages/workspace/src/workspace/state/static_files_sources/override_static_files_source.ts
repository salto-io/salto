/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { hash as lowerdashHash } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { DirectoryStore } from '../../dir_store'
import { StateStaticFilesSource } from '../../static_files/common'
import { LazyStaticFile } from '../../static_files/source'

const log = logger(module)

/**
 * Builds a static file source that does not preserve
 * the static files history and overrides it on each set.
 */
export const buildOverrideStateStaticFilesSource = (
  dirStore: DirectoryStore<Buffer>,
): StateStaticFilesSource => ({
  persistStaticFile: async file => {
    const content = await file.getContent()
    if (content === undefined) {
      log.warn(`Received file ${file.filepath} to set without content`)
      return
    }
    await dirStore.set({
      buffer: content,
      filename: file.filepath,
    })
  },
  getStaticFile: async (path, encoding, hash) => {
    if (hash === undefined) {
      throw new Error(`path ${path} was passed without a hash to getStaticFile`)
    }
    return new LazyStaticFile(
      path,
      hash,
      dirStore.getFullPath(path),
      async () => {
        const content = (await dirStore.get(path))?.buffer
        return content !== undefined
            && lowerdashHash.toMD5(content) === hash
          ? content
          : undefined
      },
      encoding
    )
  },

  rename: dirStore.rename,
  delete: file => dirStore.delete(file.filepath),
  clear: dirStore.clear,
  flush: () => log.time(
    async () => {
      await dirStore.flush()
    },
    'Flushing override static state files source',
  ),
})
