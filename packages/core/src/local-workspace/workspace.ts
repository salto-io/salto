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
import * as fileUtils from '@salto-io/file'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, CONFIG_DIR_NAME, getConfigDir } from '../app_config'
import { localState } from './state'
import { workspaceConfigSource } from './workspace_config'
import { buildLocalStaticFilesCache, CACHE_FILENAME } from './static_files_cache'

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

const getEnvPath = (baseDir: string, env: string): string => (
  env === COMMON_ENV_PREFIX ? baseDir : path.resolve(baseDir, ENVS_PREFIX, env)
)

const getEnvCachePath = (localStorage: string, env: string): string => (
  env === COMMON_ENV_PREFIX
    ? path.resolve(localStorage, CACHE_DIR_NAME, 'common')
    : path.resolve(localStorage, CACHE_DIR_NAME, ENVS_PREFIX, env)
)

export const loadLocalElementsSources = (baseDir: string, localStorage: string,
  envs: ReadonlyArray<string>): EnvironmentsSources => ({
  commonSourceName: COMMON_ENV_PREFIX,
  sources: {
    ..._.fromPairs(envs.map(env =>
      [
        env,
        {
          naclFiles: loadNaclFileSource(
            getEnvPath(baseDir, env),
            getEnvCachePath(localStorage, env)
          ),
          state: localState(path.join(getConfigDir(baseDir), STATES_DIR_NAME, env)),
        },
      ])),
    [COMMON_ENV_PREFIX]: {
      naclFiles: loadNaclFileSource(
        getEnvPath(baseDir, COMMON_ENV_PREFIX),
        getEnvCachePath(localStorage, COMMON_ENV_PREFIX),
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

export const envFolderExists = async (workspaceDir: string, env: string): Promise<boolean> => {
  const baseDir = await locateWorkspaceRoot(path.resolve(workspaceDir))
  return (baseDir !== undefined) && exists(getEnvPath(baseDir, env))
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
  const ws = await loadWorkspace(workspaceConfig, credentials, elemSources)

  const fileBasedDemoteAll = async (): Promise<void> => {
    const config = await workspaceConfig.getWorkspaceConfig()
    const envDir = getEnvPath(baseDir, config.currentEnv)
    const cacheEnvDir = getEnvCachePath(workspaceConfig.localStorage, config.currentEnv)
    const commonDir = getEnvPath(baseDir, COMMON_ENV_PREFIX)
    const commonCacheDir = getEnvCachePath(workspaceConfig.localStorage, COMMON_ENV_PREFIX)
    // Move the cache folder
    await fileUtils.mkdirp(cacheEnvDir)
    await fileUtils.mkdirp(envDir)

    // Move all of the content folder in the common dir
    const dirsToMove = [STATIC_RESOURCES_FOLDER, ...config.envs[0].services ?? []]
    const cacheDirToMove = [CACHE_FILENAME, ...config.envs[0].services ?? []]
    await Promise.all([
      ...dirsToMove.map(dirToMove => (
        fileUtils.rename(path.join(commonDir, dirToMove), path.join(envDir, dirToMove))
      )),
      ...cacheDirToMove.map(dirToMove => (
        fileUtils.rename(path.join(commonCacheDir, dirToMove), path.join(cacheEnvDir, dirToMove))
      )),
    ])
  }
  return {
    ...ws,
    demoteAll: async (): Promise<void> => {
      const envSources = Object.values(
        _.pickBy(elemSources.sources, (_src, key) => key !== elemSources.commonSourceName)
      )
      const allEnvSourcesEmpty = envSources.length === 1 && await envSources[0].naclFiles.isEmpty()
      return allEnvSourcesEmpty ? fileBasedDemoteAll() : ws.demoteAll()
    },
  }
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
