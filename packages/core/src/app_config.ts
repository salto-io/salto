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
import { CORE_ANNOTATIONS, BuiltinTypes, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { createRefToElmWithValue, applyInstancesDefaults } from '@salto-io/adapter-utils'
import { replaceContents, exists, mkdirp, readFile } from '@salto-io/file'
import { parser } from '@salto-io/workspace'
import { TelemetryConfig } from './telemetry'

const { dumpElements, parse } = parser

class AppConfigParseError extends Error {
  constructor() {
    super('failed to parse config file')
  }
}

export const SALTO_HOME_VAR = 'SALTO_HOME'
const DEFAULT_SALTO_HOME = path.join(os.homedir(), '.salto')
export const CONFIG_DIR_NAME = 'salto.config'
const CONFIG_FILENAME = 'config.nacl'

export const getConfigDir = (baseDir: string): string => (
  path.join(path.resolve(baseDir), CONFIG_DIR_NAME)
)

export const getSaltoHome = (): string =>
  process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME

const telemetryToken = (): string => (
  process.env.SALTO_TELEMETRY_TOKEN || ''
)

const telemetryURL = (): string => (
  process.env.SALTO_TELEMETRY_URL || ''
)

const telemetryDisabled = (): boolean => (
  (process.env.SALTO_TELEMETRY_DISABLE !== undefined
    && process.env.SALTO_TELEMETRY_DISABLE === '1') || telemetryURL() === ''
)

const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  url: telemetryURL(),
  token: telemetryToken(),
  enabled: !telemetryDisabled(),
}

const DEFAULT_COMMAND_CONFIG: CommandConfig = {
  shouldCalcTotalSize: true,
}

const configHomeDir = (): string => (
  path.join(getSaltoHome(), CONFIG_DIR_NAME)
)

const configFullPath = (): string => path.join(configHomeDir(), CONFIG_FILENAME)

const generateInstallationID = (): string => uuidv4()

export type CommandConfig = {
  shouldCalcTotalSize: boolean
}

export type AppConfig = {
  installationID: string
  telemetry: TelemetryConfig
  command: CommandConfig
}

const saltoConfigElemID = new ElemID('salto')
const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }

export const saltoAppConfigType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    installationID: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: requireAnno,
    },
    telemetry: {
      refType: createRefToElmWithValue(BuiltinTypes.JSON),
      annotations: requireAnno,
    },
    command: {
      refType: createRefToElmWithValue(BuiltinTypes.JSON),
      annotations: { [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_COMMAND_CONFIG },
    },
  },
  annotationRefsOrTypes: {},
  annotations: {},
})

const dumpConfig = async (config: AppConfig): Promise<void> => (
  replaceContents(
    configFullPath(),
    await dumpElements([new InstanceElement(
      ElemID.CONFIG_NAME,
      saltoAppConfigType,
      {
        installationID: config.installationID,
        telemetry: {
          enabled: config.telemetry.enabled,
        },
        config: {
          shouldCalcTotalSize: config.command.shouldCalcTotalSize,
        },
      }
    )]),
  )
)

const mergeConfigWithEnv = async (config: AppConfig): Promise<AppConfig> => {
  config.telemetry = {
    token: telemetryToken(),
    url: telemetryURL(),
    enabled: telemetryDisabled() ? false : config.telemetry.enabled,
  }
  return config
}

const configFromNaclFile = async (filepath: string): Promise<AppConfig> => {
  const buf = await readFile(filepath)
  const configInstance = (await parse(buf, filepath)).elements.pop() as InstanceElement
  if (!configInstance) throw new AppConfigParseError()

  configInstance.refType = createRefToElmWithValue(saltoAppConfigType)
  applyInstancesDefaults([configInstance])
  return configInstance.value as AppConfig
}

export const configFromDisk = async (): Promise<AppConfig> => {
  if (!await exists(configFullPath())) {
    await mkdirp(configHomeDir())
    await dumpConfig({
      installationID: generateInstallationID(),
      telemetry: DEFAULT_TELEMETRY_CONFIG,
      command: DEFAULT_COMMAND_CONFIG,
    })
  }
  const config = await configFromNaclFile(configFullPath())
  return mergeConfigWithEnv(config)
}
