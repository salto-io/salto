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
import { mapValuesAsync } from '@salto-io/lowerdash/dist/src/promises/object'
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
    currentEnv: new Field(saltoConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
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


interface EnvConfig {
  stateLocation: string
  services: string[]
  credentialsLocation: string
}

export interface Config {
  uid: string
  baseDir: string
  localStorage: string
  name: string
  envs: Record<string, {baseDir: string; config: EnvConfig}>
  currentEnv: string
}

type PartialConfig = Required<Pick<Config, 'uid' | 'name' | 'currentEnv'>> & {
  envs: Record<string, {baseDir: string; config: Partial<EnvConfig>}>
}

const createDefaultBaseConfig = (
  baseDir: string,
  workspaceName? : string,
  existingUid? : string
): Config => {
  const name = workspaceName || path.basename(baseDir)
  const uid = existingUid || uuidv5(name, SALTO_NAMESPACE) // string based uuid
  return {
    uid,
    baseDir,
    localStorage: path.join(getSaltoHome(), `${name}-${uid}`),
    name,
    envs: {},
    currentEnv: '',
  }
}

const createDefaultEnvConfig = (
  baseDir: string,
  localStorage: string,
  envDir: string,
): EnvConfig => ({
  stateLocation: path.join(baseDir, envDir, CONFIG_DIR_NAME, 'state.bpc'),
  credentialsLocation: path.join(localStorage, envDir, 'credentials'),
  services: [],
})

const resolvePath = (baseDir: string, pathToResolve: string): string => (
  path.isAbsolute(pathToResolve)
    ? pathToResolve
    : path.resolve(baseDir, pathToResolve)
)

const completeBaseConfig = (baseDir: string, baseConfig: Partial<Config>): Config => {
  const defaultBaseConfig = createDefaultBaseConfig(baseDir, baseConfig.name, baseConfig.uid)
  const fullBaseConfig = _.merge({}, defaultBaseConfig, baseConfig)
  return {
    localStorage: resolvePath(baseDir, fullBaseConfig.localStorage),
    ...fullBaseConfig,
  }
}

const completeEnvConfig = (
  baseDir: string,
  localStorage: string,
  envDir: string,
  envConfig: Partial<EnvConfig>
): EnvConfig => {
  const defaultConfig = createDefaultEnvConfig(baseDir, localStorage, envDir)
  return _.merge({}, defaultConfig, envConfig)
}

export const completeConfig = (baseDir: string, patialConfig: PartialConfig): Config => {
  const config = _.merge({}, completeBaseConfig(baseDir, patialConfig)) as Config
  const envs = _.mapValues(config.envs, env => ({
    ...env,
    config: completeEnvConfig(
      baseDir,
      config.localStorage,
      env.baseDir,
      env.config || {}
    ),
  }))
  return { ...config, envs }
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

export const getConfigPath = (baseDir: string): string => (
  path.join(baseDir, CONFIG_DIR_NAME, CONFIG_FILENAME)
)

const parseConfig = (buffer: Buffer): PartialConfig => {
  const parsedConfig = parse(buffer, '')
  const [configInstance] = [...findInstances(parsedConfig.elements, saltoConfigElemID)]
  if (!configInstance) throw new ConfigParseError()
  const rawConfig = configInstance.value
  return {
    ...rawConfig,
    envs: _.reduce(rawConfig.envs, (acc, env) => {
      acc[env.name] = { baseDir: env.baseDir, config: {} }
      return acc
    }, {} as Record<string, {baseDir: string; config: Partial<EnvConfig>}>),
  } as PartialConfig
}

const parseEnvConfig = (buffer: Buffer): Partial<EnvConfig> => {
  const parsedConfig = parse(buffer, '')
  const [configInstance] = [...findInstances(parsedConfig.elements, saltoEnvConfigElemID)]
  if (!configInstance) throw new ConfigParseError()
  return configInstance.value as unknown as Partial<EnvConfig>
}

const dumpEnvConfig = async (
  baseDir: string,
  envDir: string,
  envName: string,
  config: Partial<EnvConfig>
): Promise<void> => {
  const configDir = path.join(baseDir, envDir)
  const configPath = getConfigPath(configDir)
  await mkdirp(path.dirname(configPath))
  const configInstance = new InstanceElement(
    envName,
    saltoEnvConfigType,
    config
  )
  return replaceContents(configPath, dumpElements([configInstance]))
}

const dumpBaseConfig = async (baseDir: string, config: PartialConfig): Promise<void> => {
  const configPath = getConfigPath(baseDir)
  await mkdirp(path.dirname(configPath))
  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    saltoConfigType,
    {
      ...config,
      envs: _.entries(config.envs).map(([name, envData]) => ({ name, baseDir: envData.baseDir })),
    }
  )
  return replaceContents(configPath, dumpElements([configInstance]))
}

export const dumpConfig = async (baseDir: string, config: PartialConfig): Promise<void> => {
  await dumpBaseConfig(baseDir, config)
  await Promise.all(_.entries(config.envs).map(([name, env]) => dumpEnvConfig(
    baseDir,
    env.baseDir,
    name,
    env.config || {}
  )))
}

const baseDirFromLookup = async (lookupDir: string): Promise<string> => {
  const absLookupDir = path.resolve(lookupDir)
  const baseDir = await locateWorkspaceRoot(absLookupDir)
  if (!baseDir) {
    throw new NotAWorkspaceError()
  }
  return baseDir
}

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const baseDir = await baseDirFromLookup(lookupDir)
  const config = parseConfig(await readFile(getConfigPath(baseDir)))
  const envs = await mapValuesAsync(config.envs, async env => ({
    ...env,
    config: parseEnvConfig(await readFile(getConfigPath(path.join(baseDir, env.baseDir)))),
  }))
  log.debug(`loaded raw base config ${JSON.stringify(config)}`)
  return completeConfig(baseDir, { ...config, envs })
}

export const addServiceToConfig = async (currentConfig: Config, service: string
): Promise<void> => {
  const envConfig = currentEnvConfig(currentConfig)
  const currentServices = envConfig?.services || []
  if (currentServices.includes(service)) {
    throw new ServiceDuplicationError(service)
  }
  const config = parseConfig(await readFile(getConfigPath(currentConfig.baseDir)))
  config.envs[currentConfig.currentEnv].config = {
    ...envConfig,
    services: [...currentServices, service],
  } as EnvConfig
  await dumpConfig(currentConfig.baseDir, config)
}

export const addEnvToConfig = async (currentConfig: Config, envName: string): Promise<Config> => {
  if (_.has(currentConfig.envs, envName)) {
    throw new EnvDuplicationError(envName)
  }
  const newEnvDir = path.join('envs', envName)
  await mkdirp(newEnvDir)
  const config = parseConfig(await readFile(getConfigPath(currentConfig.baseDir)))
  config.envs = { [envName]: { baseDir: newEnvDir, config: {} }, ...config.envs }
  await dumpConfig(currentConfig.baseDir, config)
  return completeConfig(currentConfig.baseDir, config)
}

export const setCurrentEnv = async (currentConfig: Config, envName: string): Promise<Config> => {
  if (!_.has(currentConfig.envs, envName)) {
    throw new UnknownEnvError(envName)
  }
  const config = parseConfig(await readFile(getConfigPath(currentConfig.baseDir)))
  config.currentEnv = envName
  await dumpConfig(currentConfig.baseDir, config)
  return completeConfig(currentConfig.baseDir, config)
}
