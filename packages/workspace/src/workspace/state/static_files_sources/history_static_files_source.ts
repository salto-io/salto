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
import { StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { LazyStaticFile } from '../../static_files/source'
import { StateStaticFilesSource, StateStaticFilesStore } from '../../static_files/common'

const log = logger(module)

const getFileName = (filepath: string, hash: string): string =>
  `${filepath}-${hash}`

/**
 * Builds a static file source that preserve the history of the static files
 * by appending the hash of the file to its name.
 */
export const buildHistoryStateStaticFilesSource = (
  dirStore: StateStaticFilesStore,
): StateStaticFilesSource => {
  let listedFilesCache: Promise<Set<string>> | undefined

  const listFiles = async (): Promise<Set<string>> => {
    if (listedFilesCache === undefined) {
      listedFilesCache = dirStore.list().then(files => new Set(files))
    }
    return listedFilesCache
  }

  return {
    persistStaticFile: async (file: StaticFile): Promise<void> => {
      const path = getFileName(file.filepath, file.hash)
      const existingFiles = await listFiles()
      if (existingFiles.has(path)) {
        return
      }

      const content = await file.getContent()
      if (content === undefined) {
        log.warn(`Received file ${file.filepath} to set without content`)
        return
      }
      await dirStore.set({
        buffer: content,
        filename: getFileName(file.filepath, file.hash),
      })
      existingFiles.add(getFileName(file.filepath, file.hash))
    },
    getStaticFile: async (path, encoding, hash) => {
      if (hash === undefined) {
        throw new Error(`path ${path} was passed without a hash to getStaticFile`)
      }
      return new LazyStaticFile(
        path,
        hash,
        dirStore.getFullPath(path),
        async () => (await dirStore.get(getFileName(path, hash)))?.buffer,
        encoding
      )
    },

    rename: async name => {
      log.debug('rename to %s ignored in history state static files source', name)
    },
    delete: async file => {
      log.debug('delete %s ignored in history state static files source', file.filepath)
    },
    clear: async () => {
      log.debug('clear ignored in history state static files source')
    },

    flush: () => log.time(
      () => dirStore.flush(),
      'Flushing history static state files source',
    ),
  }
}
