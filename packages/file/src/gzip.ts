/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fs from 'fs'
import { Readable } from 'stream'
import { createGunzip, createGzip } from 'zlib'
import { chain } from 'stream-chain'

export const createGZipReadStream = (zipFilename: string): Readable =>
  chain([fs.createReadStream(zipFilename), createGunzip()])

export const createGZipWriteStream = (contents: Readable): Readable => chain([contents, createGzip()])
