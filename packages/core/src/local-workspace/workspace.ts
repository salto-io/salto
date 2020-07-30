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
import _ from 'lodash'
import path from 'path'
import uuidv4 from 'uuid/v4'
import { exists } from '@salto-io/file'
import { Workspace, loadWorkspace, EnvironmentsSources, initWorkspace, nacl,
  configSource as cs, parseCache, staticFiles, dirStore } from '@salto-io/workspace'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, CONFIG_DIR_NAME, getConfigDir } from '../app_config'
import { localState, STATE_EXTENSION } from './state'
import { workspaceConfigSource } from './workspace_config'
import { buildLocalStaticFilesCache } from './static_files_cache'

const { configSource } = cs
const { FILE_EXTENSION, naclFilesSource, ENVS_PREFIX } = nacl
const { parseResultCache } = parseCache
const { buildStaticFilesSource } = staticFiles

export const COMMON_ENV_PREFIX = ''
export const STATES_DIR_NAME = 'states'
export const CREDENTIALS_CONFIG_PATH = 'credentials'
export const CACHE_DIR_NAME = 'cache'
export const STATIC_RESOURCES_FOLDER = 'static-resources'

export class NotAnEmptyWorkspaceError extends Error {
  constructor(exsitingPathes: string[]) {
    super(`not an empty workspace. ${exsitingPathes.join('')} already exists.`)
  }
}

export class ExistingWorkspaceError extends Error {
  constructor() {
    super('existing salto workspace')
  }
}

export class NotAWorkspaceError extends Error {
  constructor() {
    super('not a salto workspace (or any of the parent directories)')
  }
}

export const getNaclFilesSourceParams = (
  sourceBaseDir: string,
  cacheDir: string,
  excludeDirs: string[] = []
): {
  naclFilesStore: dirStore.DirectoryStore<string>
  cache: parseCache.ParseResultCache
  staticFileSource: staticFiles.StaticFilesSource
} => {
  const dirPathToIgnore = (dirPath: string): boolean =>
    !(excludeDirs.concat(getConfigDir(sourceBaseDir))).includes(dirPath)

  const naclFilesStore = localDirectoryStore({
    baseDir: sourceBaseDir,
    encoding: 'utf8',
    fileFilter: `*${FILE_EXTENSION}`,
    directoryFilter: dirPathToIgnore,
  })

  const naclStaticFilesStore = localDirectoryStore({
    baseDir: path.join(sourceBaseDir, STATIC_RESOURCES_FOLDER),
    directoryFilter: dirPathToIgnore,
  })

  const cacheStore = localDirectoryStore({
    baseDir: cacheDir,
    encoding: 'utf8',
  })
  const staticFileSource = buildStaticFilesSource(
    naclStaticFilesStore,
    buildLocalStaticFilesCache(cacheDir),
  )
  return {
    naclFilesStore,
    cache: parseResultCache(cacheStore, staticFileSource),
    staticFileSource,
  }
}

const loadNaclFileSource = (
  sourceBaseDir: string,
  cacheDir: string,
  excludeDirs: string[] = []
): nacl.NaclFilesSource => {
  const { naclFilesStore, cache, staticFileSource } = getNaclFilesSourceParams(
    sourceBaseDir, cacheDir, excludeDirs
  )
  return naclFilesSource(naclFilesStore, cache, staticFileSource)
}

export const loadLocalElementsSources = (baseDir: string, localStorage: string,
  envs: ReadonlyArray<string>): EnvironmentsSources => ({
  commonSourceName: COMMON_ENV_PREFIX,
  sources: {
    ..._.fromPairs(envs.map(env =>
      [
        env,
        {
          naclFiles: loadNaclFileSource(
            path.resolve(baseDir, ENVS_PREFIX, env),
            path.resolve(localStorage, CACHE_DIR_NAME, ENVS_PREFIX, env)
          ),
          state: localState(path.join(getConfigDir(baseDir), STATES_DIR_NAME, `${env}${STATE_EXTENSION}`)),
        },
      ])),
    [COMMON_ENV_PREFIX]: {
      naclFiles: loadNaclFileSource(
        baseDir,
        path.resolve(localStorage, CACHE_DIR_NAME, 'common'),
        [path.join(baseDir, ENVS_PREFIX)]
      ),
    },
  },
})

const locateWorkspaceRoot = async (lookupDir: string): Promise<string|undefined> => {
  if (await exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
    return lookupDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateWorkspaceRoot(parentDir) : undefined
}

const credentialsSource = (localStorage: string): cs.ConfigSource =>
  configSource(localDirectoryStore({
    baseDir: path.join(localStorage, CREDENTIALS_CONFIG_PATH),
    encoding: 'utf8',
  }))

export const loadLocalWorkspace = async (lookupDir: string):
Promise<Workspace> => {
  const baseDir = await locateWorkspaceRoot(path.resolve(lookupDir))
  if (_.isUndefined(baseDir)) {
    throw new NotAWorkspaceError()
  }
  const workspaceConfig = await workspaceConfigSource(baseDir)
  const envs = (await workspaceConfig.getWorkspaceConfig()).envs.map(e => e.name)
  const credentials = credentialsSource(workspaceConfig.localStorage)
  const elemSources = loadLocalElementsSources(baseDir, workspaceConfig.localStorage, envs)
  return loadWorkspace(workspaceConfig, credentials, elemSources)
}

export const initLocalWorkspace = async (baseDir: string, name?: string, envName = 'default'):
Promise<Workspace> => {
  const workspaceName = name || path.basename(path.resolve(baseDir))
  const uid = uuidv4()
  const localStorage = path.join(getSaltoHome(), `${workspaceName}-${uid}`)
  if (await locateWorkspaceRoot(path.resolve(baseDir))) {
    throw new ExistingWorkspaceError()
  }
  if (await exists(localStorage)) {
    throw new NotAnEmptyWorkspaceError([localStorage])
  }

  const workspaceConfig = await workspaceConfigSource(baseDir, localStorage)
  const credentials = credentialsSource(localStorage)
  const elemSources = loadLocalElementsSources(path.resolve(baseDir), localStorage, [envName])

  return initWorkspace(
    workspaceName, uid, envName, workspaceConfig,
    credentials, elemSources,
  )
}
