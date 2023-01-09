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
import fs from 'fs'
import { Readable } from 'stream'
import { createGunzip } from 'zlib'
import getStream from 'get-stream'

export const createGZipReadStream = (
  zipFilename: string,
): Readable => (
  fs.createReadStream(zipFilename).pipe(createGunzip())
)

export const isPakoZipFile = async (zipFilename: string): Promise<boolean> => {
  const prefix = await getStream.buffer(fs.createReadStream(zipFilename, {
    encoding: 'utf8',
    start: 0,
    end: 2,
  }))
  // standard gzip compression starts with \x1f\x8b , pako adds \xc2
  return prefix.compare(Buffer.from([0x1f, 0xc2, 0x8b])) === 0
}
