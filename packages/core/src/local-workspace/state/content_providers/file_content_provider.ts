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
import path from 'path'
import origGlob from 'glob'
import { promisify } from 'util'
import { createHash } from 'crypto'
import getStream from 'get-stream'

import { collections } from '@salto-io/lowerdash'
import { exists, rm, rename, replaceContents, createReadStream } from '@salto-io/file'
import { StateContentProvider, getHashFromHashes } from './common'

const { awu } = collections.asynciterable
const glob = promisify(origGlob)

export const createFileStateContentProvider = (): StateContentProvider => {
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
      const allHashes = await Promise.all(filePaths.map(filePath => getStream.buffer(createReadStream(filePath).pipe(createHash('md5')))))
      return getHashFromHashes(allHashes.map(hashBuf => hashBuf.toString('hex')))
    },
    readContents: filePaths => (
      awu(filePaths).filter(exists).map(filePath => ({ name: filePath, stream: createReadStream(filePath) }))
    ),
    writeContents: async (prefix, contents) => {
      await Promise.all(
        contents.map(async ({ account, content }) => {
          await replaceContents(buildLocalStateFileName(prefix, account), content)
        })
      )
    },
  }
}
