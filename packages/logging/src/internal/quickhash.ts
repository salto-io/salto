/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

/* eslint-disable no-bitwise */

import wu from 'wu'

export const MAX_HASH = 2 ** 31
export const MIN_HASH = -MAX_HASH

// Adapted from: https://github.com/darkskyapp/string-hash/blob/master/index.js
// License is checked and legit

export default (s: string): number =>
  wu(s)
    .map(c => c.charCodeAt(0))
    .reduce((res, code) => (res * 33) ^ code, 5381)
