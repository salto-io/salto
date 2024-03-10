/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import { DirectoryStore } from '../../dir_store'
import { StateStaticFilesSource } from '../../static_files/common'
import { LazyStaticFile } from '../../static_files/source'

const log = logger(module)

/**
 * Builds a static file source that does not preserve
 * the static files history and overrides it on each set.
 */
export const buildOverrideStateStaticFilesSource = (dirStore: DirectoryStore<Buffer>): StateStaticFilesSource => ({
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
  getStaticFile: async (args, encoding, hash) => {
    let filePath: string
    let fileEncoding: BufferEncoding
    let fileHash: string | undefined

    // Check if args is a string or an object and assign values accordingly
    if (_.isString(args)) {
      if (encoding === undefined) {
        throw new Error("When 'args' is a string, 'encoding' must be provided")
      }
      filePath = args
      fileEncoding = encoding
      fileHash = hash
    } else {
      filePath = args.filepath
      fileEncoding = args.encoding
      fileHash = args.hash
    }
    if (fileHash === undefined) {
      throw new Error(`path ${filePath} was passed without a hash to getStaticFile`)
    }
    return new LazyStaticFile(
      filePath,
      fileHash,
      dirStore.getFullPath(filePath),
      async () => {
        const content = (await dirStore.get(filePath))?.buffer
        return content !== undefined && lowerdashHash.toMD5(content) === fileHash ? content : undefined
      },
      fileEncoding,
      _.isObject(args) ? args.isTemplate : undefined,
    )
  },

  rename: dirStore.rename,
  delete: file => dirStore.delete(file.filepath),
  clear: dirStore.clear,
  flush: () =>
    log.time(async () => {
      await dirStore.flush()
    }, 'Flushing override static state files source'),
})
