import * as path from 'path'
import os from 'os'
import uuidv5 from 'uuid/v5'
import _ from 'lodash'
import { ObjectType, ElemID, BuiltinTypes, Field, InstanceElement, Type, findInstances } from 'adapter-api'
import { logger } from '@salto/logging'
import { dump } from '../parser/dump'
import { parse } from '../parser/parse'
import { mkdirp, exists, readFile, replaceContents } from '../file'

const log = logger(module)

const CONFIG_FILENAME = 'config.bp'
const CONFIG_DIR_NAME = 'salto.config'
const DEFAULT_SALTO_HOME = path.join(os.homedir(), '.salto')
const SALTO_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'
export const SALTO_HOME_VAR = 'SALTO_HOME'

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

const saltoConfigElemID = new ElemID('salto')
const requireAnno = { [Type.REQUIRED]: true }
export const saltoConfigType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    uid: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING, requireAnno),
    baseDir: new Field(saltoConfigElemID, 'base_dir', BuiltinTypes.STRING),
    stateLocation: new Field(saltoConfigElemID, 'state_location', BuiltinTypes.STRING),
    localStorage: new Field(saltoConfigElemID, 'local_storage', BuiltinTypes.STRING),
    name: new Field(saltoConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    additionalBlueprints: new Field(
      saltoConfigElemID,
      'additional_blueprints',
      BuiltinTypes.STRING,
      {},
      true
    ),
  },
  annotationTypes: {},
  annotations: {},
})

export interface Config {
  uid: string
  baseDir: string
  stateLocation: string
  localStorage: string
  name: string
  additionalBlueprints?: string[]
}

const createDefaultConfig = (
  baseDir: string,
  workspaceName? : string,
  existingUid? : string
): Config => {
  const name = workspaceName || path.basename(baseDir)
  const saltoHome = process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME
  const uid = existingUid || uuidv5(name, SALTO_NAMESPACE) // string based uuid
  return {
    uid,
    baseDir,
    stateLocation: path.join(baseDir, CONFIG_DIR_NAME, 'state.bpc'),
    additionalBlueprints: [],
    localStorage: path.join(saltoHome, `${name}-${uid}`),
    name,
  }
}

const resolvePath = (baseDir: string, pathToResolve: string): string => (
  path.isAbsolute(pathToResolve)
    ? pathToResolve
    : path.resolve(baseDir, pathToResolve)
)

export const completeConfig = (baseDir: string, config: Partial<Config>): Config => {
  const defaultConfig = createDefaultConfig(baseDir, config.name, config.uid)
  const fullConfig = _.merge({}, defaultConfig, config)
  return {
    stateLocation: resolvePath(baseDir, fullConfig.stateLocation),
    localStorage: resolvePath(baseDir, fullConfig.localStorage),
    additionalBlueprints: (fullConfig.additionalBlueprints || [])
      .map(bp => resolvePath(baseDir, bp)),
    ...fullConfig,
  }
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

export const parseConfig = async (buffer: Buffer): Promise<Partial<Config>> => {
  const parsedConfig = await parse(buffer, '')
  const [configInstance] = [...findInstances(parsedConfig.elements, saltoConfigElemID)]
  if (!configInstance) throw new ConfigParseError()
  return _.mapKeys(configInstance.value, (_v, k) => _.camelCase(k)) as unknown as Partial<Config>
}

export const dumpConfig = async (baseDir: string, config: Partial<Config>): Promise<void> => {
  const configPath = getConfigPath(baseDir)
  await mkdirp(path.dirname(configPath))
  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    saltoConfigType,
    _.mapKeys(config as object, (_v, k) => _.snakeCase(k))
  )
  return replaceContents(configPath, await dump([configInstance]))
}

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const absLookupDir = path.resolve(lookupDir)
  const baseDir = await locateWorkspaceRoot(absLookupDir)
  if (!baseDir) {
    throw new NotAWorkspaceError()
  }
  const configData = await parseConfig(await readFile(getConfigPath(baseDir)))
  const config = completeConfig(baseDir, configData)
  log.debug(`loaded config ${JSON.stringify(config)}`)
  return config
}
