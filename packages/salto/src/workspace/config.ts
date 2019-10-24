import * as path from 'path'
import * as fs from 'async-file'
import os from 'os'
import uuidv4 from 'uuid/v4'
import uuidv5 from 'uuid/v5'
import _ from 'lodash'

const CONFIG_FILENAME = 'config.json'
const CONFIG_DIR_NAME = 'salto.config'
const DEFAULT_SALTO_HOME = path.join(os.homedir(), '.salto')
const SALTO_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'
export const SALTO_HOME_VAR = 'SALTO_HOME'

class NotAWorkspaceError extends Error {
  constructor() {
    super('not a salto workspace (or any of the parent directories)')
  }
}

class ExsitingWorkspaceError extends Error {
  constructor() {
    super('existing salto workspace')
  }
}

class NotAnEmptyWorkspaceError extends Error {
  constructor(exsitingPathes: string[]) {
    super(`not an empty workspace. ${exsitingPathes.join('')} already exists.`)
  }
}

export interface Config {
  uid: string
  baseDir: string
  stateLocation: string
  localStorage: string
  name: string
  additionalBlueprints?: string[]
}

const createDefaults = (
  configDirPath: string,
  workspaceName? : string,
  existingUid? : string
): Config => {
  const baseDir = path.resolve(path.dirname(configDirPath))
  const name = workspaceName || path.basename(baseDir)
  const saltoHome = process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME
  const uid = existingUid || uuidv5(name, SALTO_NAMESPACE) // string based uuid
  return {
    uid,
    baseDir,
    stateLocation: path.join(configDirPath, 'state.bpc'),
    additionalBlueprints: [],
    localStorage: path.join(saltoHome, `${name}-${uid}`),
    name,
  }
}

const locateConfigDir = async (lookupDir: string): Promise<string|undefined> => {
  const possibleConfigDir = path.join(lookupDir, CONFIG_DIR_NAME)
  if (await fs.exists(possibleConfigDir)) {
    return possibleConfigDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateConfigDir(parentDir) : undefined
}

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const absLookupDir = path.resolve(lookupDir)
  const configDirPath = await locateConfigDir(absLookupDir)
  if (!configDirPath) {
    throw new NotAWorkspaceError()
  }
  const configData = JSON.parse(await fs.readFile(path.join(configDirPath, CONFIG_FILENAME), 'utf8'))
  return _.merge({}, createDefaults(configDirPath, configData.name), configData)
}

const getConfigPath = (baseDir: string): string => (
  path.join(baseDir, CONFIG_DIR_NAME, CONFIG_FILENAME)
)

export const dumpConfig = async (config: Config): Promise<void> => {
  const configPath = getConfigPath(config.baseDir)
  await fs.createDirectory(path.dirname(configPath))
  return fs.writeFile(configPath, JSON.stringify(config, null, 2))
}

const ensureEmptyWorkspace = async (config: Config): Promise<void> => {
  if (await locateConfigDir(path.resolve(config.baseDir))) {
    throw new ExsitingWorkspaceError()
  }
  const configPath = getConfigPath(config.baseDir)
  const shouldNotExist = [
    configPath,
    config.localStorage,
    config.stateLocation,
  ]
  const existanceMask = await Promise.all(shouldNotExist.map(fs.exists))
  const existing = shouldNotExist.filter((_p, i) => existanceMask[i])
  if (existing.length > 0) {
    throw new NotAnEmptyWorkspaceError(existing)
  }
}

export const initConfig = async (baseDir: string, workspaceName?: string): Promise<Config> => {
  const uid = uuidv4() // random uuid
  const config = createDefaults(path.dirname(getConfigPath(baseDir)), workspaceName, uid)
  // We want to make sure that *ALL* of the pathes we are going to create
  // do not exist right now before writing anything to disk.
  await ensureEmptyWorkspace(config)
  await dumpConfig(config)
  await fs.createDirectory(config.localStorage)
  return config
}
