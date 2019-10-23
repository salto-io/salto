import * as path from 'path'
import * as fs from 'async-file'
import _ from 'lodash'

const CONFIG_FILENAME = 'config.json'
const CONFIG_DIR_NAME = 'salto.config'

class NotAWorkspaceError extends Error {
  constructor() {
    super('not a salto workspace (or any of the parent directories)')
  }
}

export interface Config {
  additionalBlueprints: string[]
  baseDir: string
  stateLocation: string
}

const createDefaults = (configDirPath: string): Config => ({
  baseDir: path.resolve(configDirPath, '..'),
  stateLocation: path.join(configDirPath, 'state.bpc'),
  additionalBlueprints: [],
})

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
  return _.merge({}, createDefaults(configDirPath), configData)
}
