
/*
*                      Copyright 2020 Salto Labs Ltd.
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

import os from 'os'
import * as path from 'path'
import uuidv4 from 'uuid/v4'
import { exists, writeFile, readTextFile, mkdirp } from './file'

const DEFAULT_SALTO_HOME = path.join(os.homedir(), '.salto')
export const SALTO_HOME_VAR = 'SALTO_HOME'
export const getSaltoHome = (): string =>
  process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME
export const getGlobalConfigDir = async (): Promise<string> => path.join(getSaltoHome(), 'salto.config')
export const getInstallationIDFile = async (): Promise<string> => path.join(await getGlobalConfigDir(), '.installation_id')

const createGlobalConfigDir = async (): Promise<unknown> => mkdirp(await getGlobalConfigDir())

const generateInstallationID = async (): Promise<void> => (
  await exists(await getInstallationIDFile())
    ? undefined : writeFile(await getInstallationIDFile(), uuidv4())
)

export const initConfig = async (): Promise<void> => {
  await createGlobalConfigDir()
  await generateInstallationID()
  return undefined
}

export const getInstallationID = async (): Promise<string> => (
  (await readTextFile(await getInstallationIDFile()))
    .trim()
)
