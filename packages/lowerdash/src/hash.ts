/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createHash } from 'crypto'

export const toMD5 = (buffer: Buffer | string): string => createHash('md5').update(buffer).digest('hex')

export const toSha1 = (input: string): string => createHash('sha1').update(input).digest('hex')
