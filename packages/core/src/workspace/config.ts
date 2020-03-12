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
import * as path from 'path'
import uuidv5 from 'uuid/v5'
import _ from 'lodash'
import {
  ObjectType, ElemID, BuiltinTypes, Field, InstanceElement,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { dumpElements } from '../parser/dump'
import { mkdirp, exists, replaceContents } from '../file'
import { getSaltoHome } from '../app_config'
import { configSource } from './config_source'
import { localDirectoryStore } from './local/dir_store'

export const CONFIG_DIR_NAME = 'salto.config'
export const STATES_DIR_NAME = 'states'
const CONFIG_FILENAME = 'config.bp'
const ADAPTERS_CONFIGS_DIR_NAME = 'adapters'
const SALTO_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'

class NotAWorkspaceError extends Error {
  constructor() {
    super('not a salto workspace (or any of the parent directories)')
  }
}

class ConfigParseError extends Error {
  constructor() {
    super('failed to parsed config file')
  }
}

class ServiceDuplicationError extends Error {
  constructor(service: string) {
    super(`${service} is already defined at this workspace`)
  }
}

class EnvDuplicationError extends Error {
  constructor(envName: string) {
    super(`${envName} is already defined at this workspace`)
  }
}

class UnknownEnvError extends Error {
  constructor(envName: string) {
    super(`Unkown enviornment ${envName}`)
  }
}

const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }
const saltoEnvConfigElemID = new ElemID('salto', 'env')
const saltoEnvConfigType = new ObjectType({
  elemID: saltoEnvConfigElemID,
  fields: {
    name: new Field(saltoEnvConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    baseDir: new Field(saltoEnvConfigElemID, 'baseDir', BuiltinTypes.STRING, requireAnno),
    stateLocation: new Field(saltoEnvConfigElemID, 'stateLocation', BuiltinTypes.STRING),
    credentialsLocation: new Field(saltoEnvConfigElemID, 'credentialsLocation', BuiltinTypes.STRING),
    services: new Field(
      saltoEnvConfigElemID,
      'services',
      BuiltinTypes.STRING,
      {},
      true
    ),
  },
})

const saltoConfigElemID = new ElemID('salto')
export const saltoConfigType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    uid: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING, requireAnno),
    baseDir: new Field(saltoConfigElemID, 'baseDir', BuiltinTypes.STRING),
    localStorage: new Field(saltoConfigElemID, 'localStorage', BuiltinTypes.STRING),
    name: new Field(saltoConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    envs: new Field(
      saltoConfigElemID,
      'envs',
      saltoEnvConfigType,
      {},
      true
    ),
  },
  annotationTypes: {},
  annotations: {},
})

const saltoLocalWorkspaceType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    currentEnv: new Field(saltoConfigElemID, 'currentEnv', BuiltinTypes.STRING, requireAnno),
  },
})

interface CurrentEnvConfig {
  currentEnv: string
}

interface EnvConfig {
  stateLocation: string
  services: string[]
  credentialsLocation: string
}

export interface Config {
  uid: string
  baseDir: string
  name: string
  envs: Record<string, {baseDir: string; config: EnvConfig}>
  currentEnv: string
  localStorage: string
}

type PartialConfig = Required<Pick<Config, 'uid' | 'name' | 'currentEnv'>> & {
  envs: Record<string, {baseDir: string; config: Partial<EnvConfig>}>
}

const getLocalStorage = (name: string, uid: string): string =>
  path.join(getSaltoHome(), `${name}-${uid}`)

const createDefaultWorkspaceConfig = (
  baseDir: string,
  workspaceName? : string,
  existingUid? : string
): Config => {
  const name = workspaceName || path.basename(baseDir)
  const uid = existingUid || uuidv5(name, SALTO_NAMESPACE) // string based uuid
  return {
    uid,
    baseDir,
    localStorage: getLocalStorage(name, uid),
    name,
    envs: {},
    currentEnv: '',
  }
}

const createDefaultEnvConfig = (
  name: string,
  baseDir: string,
  localStorage: string,
  envDir: string,
): EnvConfig => ({
  stateLocation: path.resolve(baseDir, CONFIG_DIR_NAME, STATES_DIR_NAME, `${name}.bpc`),
  credentialsLocation: path.resolve(localStorage, envDir, 'credentials'),
  services: [],
})

const resolvePath = (baseDir: string, pathToResolve: string): string => (
  path.isAbsolute(pathToResolve)
    ? pathToResolve
    : path.resolve(baseDir, pathToResolve)
)

const parseConfig = (configInstance: InstanceElement | undefined): PartialConfig => {
  if (!configInstance) throw new ConfigParseError()
  return configInstance.value as PartialConfig
}

const parseLocalWorkspaceConfig = (configInstance: InstanceElement | undefined):
CurrentEnvConfig => {
  if (!configInstance) throw new ConfigParseError()
  return configInstance.value as unknown as CurrentEnvConfig
}

const completeWorkspaceConfig = (baseDir: string, workspaceConfig: Partial<Config>): Config => {
  const defaultWorkspaceConfig = createDefaultWorkspaceConfig(
    baseDir,
    workspaceConfig.name,
    workspaceConfig.uid
  )
  const fullWorkspaceConfig = _.merge({}, defaultWorkspaceConfig, workspaceConfig)
  return {
    localStorage: resolvePath(baseDir, fullWorkspaceConfig.localStorage),
    ...fullWorkspaceConfig,
  }
}

const completeEnvConfig = (
  name: string,
  baseDir: string,
  localStorage: string,
  envDir: string,
  envConfig: Partial<EnvConfig>
): EnvConfig => {
  const defaultConfig = createDefaultEnvConfig(name, baseDir, localStorage, envDir)
  return _.merge({}, defaultConfig, envConfig)
}

export const getLocalWorkspaceConfigDir = (baseDir: string, localStorage: string): string => (
  path.resolve(baseDir, localStorage)
)

export const getLocalWorkspaceConfigPath = (baseDir: string, localStorage: string): string => (
  path.join(getLocalWorkspaceConfigDir(baseDir, localStorage), CONFIG_FILENAME)
)

export const completeConfig = async (baseDir: string, partialConfig: PartialConfig):
Promise<Config> => {
  const config = _.merge({}, completeWorkspaceConfig(baseDir, partialConfig)) as Config
  const envs = _.mapValues(config.envs, (env, name) => ({
    ...env,
    config: completeEnvConfig(
      name,
      baseDir,
      config.localStorage,
      env.baseDir,
      env.config || {}
    ),
  }))

  const currentEnv = _.isEmpty(config.currentEnv)
    ? parseLocalWorkspaceConfig(
      await configSource(
        localDirectoryStore(getLocalWorkspaceConfigDir(baseDir, config.localStorage))
      ).get(CONFIG_FILENAME.split('.')[0])
    ).currentEnv
    : config.currentEnv
  return { ...config, currentEnv, envs }
}

export const locateWorkspaceRoot = async (lookupDir: string): Promise<string|undefined> => {
  if (await exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
    return lookupDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateWorkspaceRoot(parentDir) : undefined
}

export const currentEnvConfig = (config: Config): EnvConfig => (
  config.envs[config.currentEnv].config
)

export const getConfigDir = (baseDir: string): string => (
  path.join(baseDir, CONFIG_DIR_NAME)
)

export const getConfigPath = (baseDir: string): string => (
  path.join(getConfigDir(baseDir), CONFIG_FILENAME)
)

export const getAdaptersConfigDir = (baseDir: string): string => (
  path.resolve(path.join(getConfigDir(baseDir), ADAPTERS_CONFIGS_DIR_NAME))
)

const dumpWorkspaceConfig = async (configPath: string, config: PartialConfig, type: ObjectType):
Promise<void> => {
  await mkdirp(path.dirname(configPath))
  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    _.pick(config, Object.keys(type.fields)),
  )
  return replaceContents(configPath, dumpElements([configInstance]))
}

export const dumpConfig = async (
  baseDir: string, config: PartialConfig, localStorage?: string,
): Promise<void> => {
  await dumpWorkspaceConfig(getConfigPath(baseDir), config, saltoConfigType)
  if (localStorage) {
    await dumpWorkspaceConfig(
      getLocalWorkspaceConfigPath(baseDir, localStorage),
      config,
      saltoLocalWorkspaceType,
    )
  }
}

const baseDirFromLookup = async (lookupDir: string): Promise<string> => {
  const absLookupDir = path.resolve(lookupDir)
  const baseDir = await locateWorkspaceRoot(absLookupDir)
  if (!baseDir) {
    throw new NotAWorkspaceError()
  }
  return baseDir
}

const readConfig = async (baseDir: string): Promise<PartialConfig> =>
  parseConfig(await configSource(localDirectoryStore(getConfigDir(baseDir)))
    .get(CONFIG_FILENAME.split('.')[0]))

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const baseDir = await baseDirFromLookup(lookupDir)
  const config = await readConfig(baseDir)
  return completeConfig(baseDir, config)
}

export const addServiceToConfig = async (currentConfig: Config, service: string
): Promise<void> => {
  const envConfig = currentEnvConfig(currentConfig)
  const currentServices = envConfig?.services || []
  if (currentServices.includes(service)) {
    throw new ServiceDuplicationError(service)
  }
  const config = await readConfig(currentConfig.baseDir)
  config.envs[currentConfig.currentEnv].config.services = [...currentServices, service]
  await dumpConfig(currentConfig.baseDir, config)
}

export const addEnvToConfig = async (currentConfig: Config, envName: string): Promise<Config> => {
  if (_.has(currentConfig.envs, envName)) {
    throw new EnvDuplicationError(envName)
  }
  const newEnvDir = path.join('envs', envName)
  await mkdirp(newEnvDir)
  const config = await readConfig(currentConfig.baseDir)
  config.envs = { [envName]: { baseDir: newEnvDir, config: {} }, ...config.envs }
  await dumpConfig(currentConfig.baseDir, config)
  return completeConfig(currentConfig.baseDir, config)
}

export const setCurrentEnv = async (currentConfig: Config, envName: string): Promise<Config> => {
  if (!_.has(currentConfig.envs, envName)) {
    throw new UnknownEnvError(envName)
  }
  const config = await readConfig(currentConfig.baseDir)
  config.currentEnv = envName
  await dumpConfig(currentConfig.baseDir, config, currentConfig.localStorage)
  return completeConfig(currentConfig.baseDir, config)
}
