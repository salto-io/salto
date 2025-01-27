/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fs from 'fs'
import path from 'path'

const validateAccess = (filename: string): boolean => {
  try {
    // eslint-disable-next-line no-bitwise
    fs.accessSync(filename, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}
const canWrite = (filename: string): boolean => {
  if (fs.existsSync(filename)) {
    return validateAccess(filename)
  }
  if (fs.existsSync(path.dirname(filename))) {
    return validateAccess(path.dirname(filename))
  }
  return false
}

export const validateLogFile = (filename: string): string | undefined => (canWrite(filename) ? filename : undefined)
