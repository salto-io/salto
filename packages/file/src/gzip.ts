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
import fs from 'fs'
import pako from 'pako'
import { Readable } from 'stream'
import { createGunzip, createGzip } from 'zlib'
import { chain } from 'stream-chain'
import getStream from 'get-stream'
import { logger } from '@salto-io/logging'
import { readFile } from './file'

const log = logger(module)

export const createGZipReadStream = (
  zipFilename: string,
): Readable => chain([
  fs.createReadStream(zipFilename),
  createGunzip(),
])

export const createGZipWriteStream = (
  contents: Readable,
): Readable => chain([
  contents,
  createGzip(),
])


//
// the rest of this file contains backward-compatibility with old state file -
// should be removed once all workspaces have been upgraded (see SALTO-3149)
//

export const isOldFormatStateZipFile = async (zipFilename: string): Promise<boolean> => {
  const prefix = await getStream.buffer(fs.createReadStream(zipFilename, {
    start: 0,
    end: 2,
  }))
  // standard gzip compression starts with \x1f\x8b , the old state file added \xc2
  return prefix.compare(Buffer.from([0x1f, 0xc2, 0x8b])) === 0
}

export const readOldFormatGZipFile = async (
  zipFilename: string,
): Promise<string | undefined> => {
  const data = await readFile(zipFilename, { encoding: 'utf8' })
  try {
    return pako.ungzip(data, { to: 'string' })
  } catch (e) {
    log.error(`Couldn't unzip file: ${zipFilename}: ${e}`)
    return undefined
  }
}
