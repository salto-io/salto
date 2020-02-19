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
import { ObjectType, ElemID, BuiltinTypes, Field, InstanceElement, findInstances, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { dumpElements } from '../parser/dump'
import { parse } from '../parser/parse'
import { mkdirp, exists, readFile, replaceContents } from '../file'
import { getSaltoHome } from '../app_config'

const log = logger(module)

const CONFIG_FILENAME = 'config.bp'
const CONFIG_DIR_NAME = 'salto.config'
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
const saltoEnvConfigElemID = new ElemID('salto', 'env_config')
const saltoEnvConfigType = new ObjectType({
  elemID: saltoEnvConfigElemID,
  fields: {
    name: new Field(saltoEnvConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    baseDir: new Field(saltoEnvConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
  },
})

const saltoConfigElemID = new ElemID('salto')
export const saltoConfigType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    uid: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING, requireAnno),
    baseDir: new Field(saltoConfigElemID, 'base_dir', BuiltinTypes.STRING),
    stateLocation: new Field(saltoConfigElemID, 'state_location', BuiltinTypes.STRING),
    credentialsLocation: new Field(saltoConfigElemID, 'state_location', BuiltinTypes.STRING),
    localStorage: new Field(saltoConfigElemID, 'local_storage', BuiltinTypes.STRING),
    name: new Field(saltoConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    currentEnv: new Field(saltoConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    services: new Field(
      saltoConfigElemID,
      'services',
      BuiltinTypes.STRING,
      {},
      true
    ),
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

interface EnvSettings {
  name: string
  baseDir: string
}

export interface Config {
  uid: string
  baseDir: string
  stateLocation: string
  credentialsLocation: string
  localStorage: string
  name: string
  services: string[]
  envs: EnvSettings[]
  currentEnv? : string
}

const ENV_CONFIG_FIELDS = ['services', 'stateLocation', 'credentialsLocation']
type EnvConfig = Pick<Config, 'services' | 'stateLocation' | 'credentialsLocation'>
type BaseConfig = Omit<Config, 'services' | 'stateLocation' | 'credentialsLocation'>

const createDefaultBaseConfig = (
  baseDir: string,
  workspaceName? : string,
  existingUid? : string
): BaseConfig => {
  const name = workspaceName || path.basename(baseDir)
  const uid = existingUid || uuidv5(name, SALTO_NAMESPACE) // string based uuid
  return {
    uid,
    baseDir,
    localStorage: path.join(getSaltoHome(), `${name}-${uid}`),
    name,
    envs: [],
  }
}

const createDefaultEnvConfig = (
  envDir: string,
): EnvConfig => ({
  stateLocation: path.join(envDir, CONFIG_DIR_NAME, 'state.bpc'),
  credentialsLocation: path.join(envDir, 'credentials'),
  services: [],
})

const resolvePath = (baseDir: string, pathToResolve: string): string => (
  path.isAbsolute(pathToResolve)
    ? pathToResolve
    : path.resolve(baseDir, pathToResolve)
)

const completeBaseConfig = (baseDir: string, baseConfig: Partial<BaseConfig>): BaseConfig => {
  const defaultBaseConfig = createDefaultBaseConfig(baseDir, baseConfig.name, baseConfig.uid)
  const fullBaseConfig = _.merge({}, defaultBaseConfig, baseConfig)
  return {
    localStorage: resolvePath(baseDir, fullBaseConfig.localStorage),
    ...fullBaseConfig,
  }
}

const completeEnvConfig = (
  baseDir: string,
  envDir: string,
  envConfig: Partial<EnvConfig>
): EnvConfig => {
  const defaultConfig = createDefaultEnvConfig(envDir)
  const fullEnvConfig = _.merge({}, defaultConfig, envConfig)
  return {
    stateLocation: resolvePath(baseDir, fullEnvConfig.stateLocation),
    credentialsLocation: resolvePath(baseDir, fullEnvConfig.credentialsLocation),
    ...fullEnvConfig,
  }
}

const getCurrentEnvPath = (baseConfig: BaseConfig): string => {
  const currentEnv = baseConfig.envs.find(env => env.name === baseConfig.currentEnv)
  return currentEnv ? currentEnv.baseDir : '.'
}

export const completeConfig = (baseDir: string, config: Partial<Config>): Config => {
  const fullBaseConfig = completeBaseConfig(baseDir, config)
  const envDir = getCurrentEnvPath(fullBaseConfig)
  const fullEnvConfig = completeEnvConfig(baseDir, envDir, config)
  return _.merge({}, fullBaseConfig, fullEnvConfig)
}

export const locateWorkspaceRoot = async (lookupDir: string): Promise<string|undefined> => {
  if (await exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
    return lookupDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateWorkspaceRoot(parentDir) : undefined
}

export const getConfigPath = (baseDir: string): string => (
  path.join(baseDir, CONFIG_DIR_NAME, CONFIG_FILENAME)
)

const parseConfig = (buffer: Buffer): Partial<Config> => {
  const parsedConfig = parse(buffer, '')
  const [configInstance] = [...findInstances(parsedConfig.elements, saltoConfigElemID)]
  if (!configInstance) throw new ConfigParseError()
  return _.mapKeys(configInstance.value, (_v, k) => _.camelCase(k)) as unknown as Partial<Config>
}

const dumpEnvConfig = async (baseDir: string, config: Partial<Config>): Promise<void> => {
  const baseConfig = completeBaseConfig(baseDir, config)
  const configPath = getConfigPath(getCurrentEnvPath(baseConfig))
  const envConfig = _.pick(config, ENV_CONFIG_FIELDS)
  await mkdirp(path.dirname(configPath))
  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    saltoConfigType,
    _.mapKeys(envConfig as object, (_v, k) => _.snakeCase(k))
  )
  return replaceContents(configPath, dumpElements([configInstance]))
}

const dumpBaseConfig = async (baseDir: string, config: Partial<Config>): Promise<void> => {
  const configPath = getConfigPath(baseDir)
  await mkdirp(path.dirname(configPath))
  const baseConfig = _.omit(config, ENV_CONFIG_FIELDS)
  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    saltoConfigType,
    _.mapKeys(baseConfig as object, (_v, k) => _.snakeCase(k))
  )
  return replaceContents(configPath, dumpElements([configInstance]))
}

export const dumpConfig = async (baseDir: string, config: Partial<Config>): Promise<void> => {
  await dumpBaseConfig(baseDir, config)
  await dumpEnvConfig(baseDir, config)
}

const baseDirFromLookup = async (lookupDir: string): Promise<string> => {
  const absLookupDir = path.resolve(lookupDir)
  const baseDir = await locateWorkspaceRoot(absLookupDir)
  if (!baseDir) {
    throw new NotAWorkspaceError()
  }
  return baseDir
}

const loadBaseConfig = async (lookupDir: string): Promise<BaseConfig> => {
  const baseDir = await baseDirFromLookup(lookupDir)
  const baseConfig = parseConfig(await readFile(getConfigPath(baseDir)))
  log.debug(`loaded raw base config ${JSON.stringify(baseConfig)}`)
  return completeBaseConfig(baseDir, baseConfig)
}

const loadEnvConfig = async (baseConfig: BaseConfig): Promise<EnvConfig> => {
  const envDir = getCurrentEnvPath(baseConfig)
  const configPath = path.resolve(baseConfig.baseDir, getConfigPath(envDir))
  const envConfig = await exists(configPath)
    ? parseConfig(await readFile(configPath))
    : {}
  log.debug(`loaded raw env config ${JSON.stringify(envConfig)}`)
  return completeEnvConfig(baseConfig.baseDir, envDir, envConfig)
}

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const baseConfig = await loadBaseConfig(lookupDir)
  const envConfig = await loadEnvConfig(baseConfig)
  return _.merge({}, baseConfig, envConfig || {})
}

export const addServiceToConfig = async (currentConfig: Config, service: string
): Promise<void> => {
  const currentServices = currentConfig.services ? currentConfig.services : []
  if (currentServices.includes(service)) {
    throw new ServiceDuplicationError(service)
  }
  const config = parseConfig(await readFile(getConfigPath(currentConfig.baseDir)))
  config.services = [...currentServices, service]
  await dumpEnvConfig(currentConfig.baseDir, config)
}

export const addEnvToConfig = async (currentConfig: Config, envName: string): Promise<Config> => {
  if (currentConfig.envs.find(env => env.name === envName)) {
    throw new EnvDuplicationError(envName)
  }
  const newEnvDir = path.join('envs', envName)
  await mkdirp(newEnvDir)
  const config = parseConfig(await readFile(getConfigPath(currentConfig.baseDir)))
  config.envs = [...currentConfig.envs, { name: envName, baseDir: newEnvDir }]
  await dumpBaseConfig(currentConfig.baseDir, config)
  return completeConfig(currentConfig.baseDir, config)
}

export const setCurrentEnv = async (currentConfig: Config, envName: string): Promise<Config> => {
  if (!currentConfig.envs.find(env => env.name === envName)) {
    throw new UnknownEnvError(envName)
  }
  const config = parseConfig(await readFile(getConfigPath(currentConfig.baseDir)))
  config.currentEnv = envName
  await dumpBaseConfig(currentConfig.baseDir, config)
  return completeConfig(currentConfig.baseDir, config)
}
