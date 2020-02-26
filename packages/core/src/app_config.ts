
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
import { TelemetryConfig } from './telemetry'

const DEFAULT_SALTO_HOME = path.join(os.homedir(), '.salto')
export const SALTO_HOME_VAR = 'SALTO_HOME'

export const getSaltoHome = (): string =>
  process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME

const globalConfigDirSuffix = 'salto.config'
const installationIDFilename = 'installation_id'

const configHomeDir = (): string => (
  path.join(getSaltoHome(), globalConfigDirSuffix)
)
const installationIDFullPath = (): string => (
  path.join(configHomeDir(), installationIDFilename)
)

const telemetryToken = process.env.SALTO_TELEMETRY_TOKEN || ''

const getTelemetryURL = (): string => (
  process.env.SALTO_TELEMETRY_URL || 'https://telemetry.salto.io'
)

const getTelemetryEnabled = (): boolean => (
  process.env.SALTO_TELEMETRY_DISABLE === undefined
)

export type AppConfig = {
  installationID: string
  telemetry: TelemetryConfig
}

const loadInstallatioIDFromDisk = async (): Promise<string> => {
  if (!await exists(installationIDFullPath())) {
    throw Error('cannot find installation id file on disk')
  }

  const installationID = await readTextFile(installationIDFullPath())
  return Promise.resolve(installationID.trim())
}

export const configFromDisk = async (): Promise<AppConfig> => {
  await mkdirp(configHomeDir())

  if (!await exists(installationIDFullPath())) {
    const installationID = uuidv4()
    await writeFile(installationIDFullPath(), installationID)
  }

  const installationID = await loadInstallatioIDFromDisk()
  return {
    installationID,
    telemetry: {
      url: getTelemetryURL(),
      enabled: getTelemetryEnabled(),
      token: telemetryToken,
    },
  }
}
