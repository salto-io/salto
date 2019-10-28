import * as path from 'path'
import * as fs from 'async-file'
import os from 'os'
import uuidv5 from 'uuid/v5'
import _ from 'lodash'
import { ObjectType, ElemID, BuiltinTypes, Field, InstanceElement, isInstanceElement } from 'adapter-api'
import { dump } from '../parser/dump'
import { parse } from '../parser/parse'

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
const saltoConfigInstanceID = new ElemID('salto', ElemID.CONFIG_INSTANCE_NAME)
const saltoConfigElemID = new ElemID('salto')
export const saltoConfigType = new ObjectType({
  elemID: saltoConfigElemID,
  fields: {
    uid: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING),
    baseDir: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING),
    stateLocation: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING),
    localStorage: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING),
    name: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING),
    additionalBlueprints: new Field(saltoConfigElemID, 'uid', BuiltinTypes.STRING, {}, true),
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

export const completeConfig = (baseDir: string, config: Partial<Config>): Config => {
  const defaultConfig = createDefaultConfig(baseDir, config.name, config.uid)
  return _.merge({}, defaultConfig, config)
}

export const locateWorkspaceRoot = async (lookupDir: string): Promise<string|undefined> => {
  if (await fs.exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
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
  const [configInstance] = parsedConfig.elements
    .filter(e => _.isEqual(e.elemID, saltoConfigInstanceID))
    .filter(isInstanceElement)
  return configInstance.value as unknown as Partial<Config>
}

export const dumpConfig = async (baseDir: string, config: Partial<Config>): Promise<void> => {
  const configPath = getConfigPath(baseDir)
  await fs.createDirectory(path.dirname(configPath))
  const configInstance = new InstanceElement(saltoConfigInstanceID, saltoConfigType, config)
  return fs.writeFile(configPath, await dump([configInstance]))
}

export const loadConfig = async (lookupDir: string): Promise<Config> => {
  const absLookupDir = path.resolve(lookupDir)
  const baseDir = await locateWorkspaceRoot(absLookupDir)
  if (!baseDir) {
    throw new NotAWorkspaceError()
  }
  const configData = await parseConfig(await fs.readFile(getConfigPath(baseDir), 'utf8'))
  return completeConfig(baseDir, configData)
}
