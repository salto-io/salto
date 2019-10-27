import * as path from 'path'
import * as fs from 'async-file'
import os from 'os'
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

export interface Config {
  uid: string
  baseDir: string
  stateLocation: string
  localStorage: string
  name: string
  additionalBlueprints?: string[]
}

export const createDefaultConfig = (
  configDirPath: string,
  workspaceName? : string,
  existingUid? : string
): Config => {
  const absConfigDirPath = path.resolve(configDirPath)
  const baseDir = path.dirname(absConfigDirPath)
  const name = workspaceName || path.basename(baseDir)
  const saltoHome = process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME
  const uid = existingUid || uuidv5(name, SALTO_NAMESPACE) // string based uuid
  return {
    uid,
    baseDir,
    stateLocation: path.join(absConfigDirPath, 'state.bpc'),
    additionalBlueprints: [],
    localStorage: path.join(saltoHome, `${name}-${uid}`),
    name,
  }
}

export const locateConfigDir = async (lookupDir: string): Promise<string|undefined> => {
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
  return _.merge({}, createDefaultConfig(configDirPath, configData.name), configData)
}

export const getConfigPath = (baseDir: string): string => (
  path.join(baseDir, CONFIG_DIR_NAME, CONFIG_FILENAME)
)

export const dumpConfig = async (config: Config): Promise<void> => {
  const configPath = getConfigPath(config.baseDir)
  await fs.createDirectory(path.dirname(configPath))
  return fs.writeFile(configPath, JSON.stringify(config, null, 2))
}
