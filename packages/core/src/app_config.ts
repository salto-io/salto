
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
import {
  CORE_ANNOTATIONS, BuiltinTypes,
  Field, ObjectType, ElemID, InstanceElement,
  findInstances,
} from '@salto-io/adapter-api'
import { replaceContents, exists, mkdirp, readFile } from './file'
import { TelemetryConfig } from './telemetry'
import { dumpElements } from './parser/dump'
import { parse } from './parser/parse'

class AppConfigParseError extends Error {
  constructor() {
    super('failed to parse config file')
  }
}

const DEFAULT_SALTO_HOME = path.join(os.homedir(), '.salto')
export const SALTO_HOME_VAR = 'SALTO_HOME'

export const getSaltoHome = (): string =>
  process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME

const telemetryDisabled = process.env.SALTO_TELEMETRY_DISABLE !== undefined
const GLOBAL_CONFIG_DIR_SUFFIX = 'salto.config'
const CONFIG_FILENAME = 'config.bp'
const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  url: 'https://telemetry.salto.io',
  token: '',
  enabled: !telemetryDisabled,
}

const configHomeDir = (): string => (
  path.join(getSaltoHome(), GLOBAL_CONFIG_DIR_SUFFIX)
)

const configFullPath = (): string => path.join(configHomeDir(), CONFIG_FILENAME)

type saltoConfig = {
  installationID: string
}
export type AppConfig = {
  telemetry: TelemetryConfig
} & saltoConfig

const saltoConfigElemID = new ElemID('salto')
const telemetryElemID = new ElemID('telemetry')
const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }
export const saltoAppConfigType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    installationID: new Field(saltoConfigElemID, 'installationID', BuiltinTypes.STRING, requireAnno),
  },
  annotationTypes: {},
  annotations: {},
})

export const telemetryConfigType = new ObjectType({
  elemID: telemetryElemID,
  fields: {
    url: new Field(telemetryElemID, 'url', BuiltinTypes.STRING, requireAnno),
    token: new Field(telemetryElemID, 'token', BuiltinTypes.STRING, requireAnno),
    enabled: new Field(telemetryElemID, 'enabled', BuiltinTypes.BOOLEAN, requireAnno),
  },
  annotationTypes: {},
  annotations: {},
})

const dumpConfig = async (config: AppConfig): Promise<void> => {
  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    saltoAppConfigType,
    {
      installationID: config.installationID,
    }
  )

  const telemetryConfigInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    telemetryConfigType,
    config.telemetry,
  )

  return replaceContents(configFullPath(), dumpElements([configInstance, telemetryConfigInstance]))
}

const configFromBPFile = async (filepath: string): Promise<AppConfig> => {
  const buf = await readFile(filepath)
  const parsed = parse(buf, '')
  const [configInstance] = [...findInstances(parsed.elements, saltoConfigElemID)]
  const [telemetryInstance] = [...findInstances(parsed.elements, telemetryElemID)]
  if (!configInstance || !telemetryInstance) throw new AppConfigParseError()

  const telemetryConfig = telemetryInstance.value as TelemetryConfig
  if (telemetryDisabled) {
    telemetryConfig.enabled = false
  }

  return {
    installationID: (configInstance.value as saltoConfig).installationID,
    telemetry: telemetryConfig,
  }
}

export const configFromDisk = async (): Promise<AppConfig> => {
  if (!await exists(configFullPath())) {
    await mkdirp(configHomeDir())
    await dumpConfig({ installationID: uuidv4(), telemetry: DEFAULT_TELEMETRY_CONFIG })
  }
  return configFromBPFile(configFullPath())
}
