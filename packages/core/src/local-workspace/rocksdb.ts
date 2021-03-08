/*
*                      Copyright 2021 Salto Labs Ltd.
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
import rimraf from 'rimraf'
import fsExtra from 'fs-extra'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractAndRequire = (externalsLocation: string, module: string): any => {
  // eslint-disable-next-line @typescript-eslint/camelcase
  if (typeof __non_webpack_require__ !== 'undefined') {
    const extractedModuleLocation = path.join(externalsLocation, module)
    rimraf.sync(externalsLocation)
    // eslint-disable-next-line no-undef, @typescript-eslint/camelcase
    fsExtra.copySync(path.dirname(__non_webpack_require__.resolve(module)), extractedModuleLocation,
      { dereference: true })
    // eslint-disable-next-line no-undef
    const result = __non_webpack_require__(extractedModuleLocation)
    try {
      rimraf.sync(externalsLocation)
    } catch {
      // Do nothing. Deleting will fail on required native code on Windows.
    }
    return result
  }
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(module)
}

export default extractAndRequire(path.join(__dirname, '.externals'), 'rocksdb')
