
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

const globalConfigDirSuffix = 'salto.config'
const installationIDFilename = '.installation_id'

const configHomeDir = (): string => (
  path.join(getSaltoHome(), globalConfigDirSuffix)
)
const installationIDFullPath = (): string => (
  path.join(configHomeDir(), installationIDFilename)
)

export type AppConfig = {
  installationID: string
}

const loadInstallatioIDFromDisk = async (): Promise<AppConfig> => {
  if (!await exists(installationIDFullPath())) {
    throw Error('cannot find installation id file on disk')
  }

  const installationID = (await readTextFile(installationIDFullPath())).trim()
  return { installationID }
}

export const initOnDisk = async (): Promise<AppConfig> => {
  await mkdirp(configHomeDir())

  if (!await exists(installationIDFullPath())) {
    const installationID = uuidv4()
    await writeFile(installationIDFullPath(), installationID)
  }

  return loadInstallatioIDFromDisk()
}
