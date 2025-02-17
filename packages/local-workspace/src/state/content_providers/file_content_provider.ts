/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import origGlob from 'glob'
import { promisify } from 'util'
import { createHash } from 'crypto'
import getStream from 'get-stream'

import { collections } from '@salto-io/lowerdash'
import { state } from '@salto-io/workspace'
import { exists, rm, rename, replaceContents, createReadStream } from '@salto-io/file'
import { StateContentProvider, getHashFromHashes } from './common'
import { localDirectoryStore } from '../../dir_store'
import { STATIC_RESOURCES_FOLDER } from '../../workspace'

const { awu } = collections.asynciterable
const glob = promisify(origGlob)

export const createFileStateContentProvider = (localStorageDir: string): StateContentProvider => {
  const buildLocalStateFileName = (prefix: string, account: string): string => `${prefix}.${account}.jsonl.zip`
  const findStateFiles = (prefix: string): Promise<string[]> => glob(buildLocalStateFileName(prefix, '*([!.])'))
  return {
    findStateFiles,
    clear: async prefix => {
      await Promise.all((await findStateFiles(prefix)).map(filename => rm(filename)))
    },
    rename: async (oldPrefix, newPrefix) => {
      const stateFiles = await findStateFiles(oldPrefix)
      await awu(stateFiles).forEach(async filename => {
        const newFilePath = filename.replace(oldPrefix, path.join(path.dirname(oldPrefix), newPrefix))
        await rename(filename, newFilePath)
      })
    },
    getHash: async filePaths => {
      const allHashes = await Promise.all(
        filePaths.map(filePath =>
          getStream.buffer(
            // We should not be passing an encoding here, but we do to maintain backwards compatibility
            // fixing this would cause the hash to change to the correct hash value, but that would
            // trigger invalidation in all caches
            createReadStream(filePath, { encoding: 'utf8' }).pipe(createHash('md5')),
          ),
        ),
      )
      const digests = allHashes.map(hashBuf => hashBuf.toString('hex'))
      return getHashFromHashes(digests)
    },
    readContents: filePaths =>
      awu(filePaths)
        .filter(exists)
        .map(filePath => ({ name: filePath, stream: createReadStream(filePath) })),
    writeContents: async (prefix, contents) => {
      await Promise.all(
        contents.map(async ({ account, content }) => {
          await replaceContents(buildLocalStateFileName(prefix, account), content)
        }),
      )
    },
    staticFilesSource: state.buildOverrideStateStaticFilesSource(
      localDirectoryStore({ baseDir: path.resolve(localStorageDir, STATIC_RESOURCES_FOLDER) }),
    ),
  }
}
