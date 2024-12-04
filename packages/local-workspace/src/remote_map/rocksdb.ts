/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import rimraf from 'rimraf'
import fsExtra from 'fs-extra'
import path from 'path'
import { getSaltoHome } from '../app_config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requireOrExtract = (externalsLocation: string): any => {
  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
    return require('@salto-io/rocksdb')
  } catch {
    // eslint-disable-next-line camelcase
    if (typeof __non_webpack_require__ !== 'undefined') {
      const extractedModuleLocation = path.join(externalsLocation, 'rocksdb')
      rimraf.sync(externalsLocation)
      // eslint-disable-next-line camelcase
      fsExtra.copySync(path.dirname(__non_webpack_require__.resolve('@salto-io/rocksdb')), extractedModuleLocation, {
        dereference: true,
      })
      const result = __non_webpack_require__(extractedModuleLocation)
      try {
        rimraf.sync(externalsLocation)
      } catch {
        // Do nothing. Deleting will fail on required native code on Windows.
      }
      return result
    }
  }
  // require failed, hope you don't actually need it but rather you're in a test environment
  return undefined
}

export default requireOrExtract(path.join(getSaltoHome(), '.externals'))
