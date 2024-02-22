/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import path from 'path'

const validateAccess = (filename: string): boolean => {
  try {
    // eslint-disable-next-line no-bitwise
    fs.accessSync(filename, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch (err) {
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
