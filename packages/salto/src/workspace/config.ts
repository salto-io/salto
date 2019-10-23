import * as path from 'path'
import * as fs from 'async-file'
import _ from 'lodash'

const CONFIG_FILENAME = 'config.json'
const CONFIG_DIR_NAME = 'salto.config'
const DEFAULT_SALTO_HOME = '~/.salto'
export const SALTO_HOME_VAR = 'SALTO_HOME'

class NotAWorkspaceError extends Error {
  constructor() {
    super('not a salto workspace (or any of the parent directories)')
  }
}

export interface Config {
  baseDir: string
  stateLocation: string
  localStorage: string
  name: string
  additionalBlueprints?: string[]
}

const createDefaults = (
  configDirPath: string,
  workspaceName? : string
): Config => {
  const baseDir = path.dirname(configDirPath)
  const name = workspaceName || path.basename(baseDir)
  const saltoHome = process.env[SALTO_HOME_VAR] || DEFAULT_SALTO_HOME
  return {
    baseDir,
    stateLocation: path.join(configDirPath, 'state.bpc'),
    additionalBlueprints: [],
    localStorage: path.join(saltoHome, name),
    name,
  }
}

const locateConfigDir = async (lookupDir: string): Promise<string> => {
  const possibleConfigDir = path.join(lookupDir, CONFIG_DIR_NAME)
  if (await fs.exists(possibleConfigDir)) {
    return possibleConfigDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  if (!parentDir) throw new NotAWorkspaceError()
  return locateConfigDir(parentDir)
}

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const absLookupDir = path.resolve(lookupDir)
  const configDirPath = await locateConfigDir(absLookupDir)
  const configData = JSON.parse(await fs.readFile(path.join(configDirPath, CONFIG_FILENAME), 'utf8'))
  return _.merge({}, createDefaults(configDirPath, configData.name), configData)
}
