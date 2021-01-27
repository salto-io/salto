/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { DetailedChange } from '@salto-io/adapter-api'
import { exists, isEmptyDir, rm } from '@salto-io/file'
import { Workspace, loadWorkspace, EnvironmentsSources, initWorkspace, nacl, remoteMap,
  configSource as cs, parseCache, staticFiles, dirStore, WorkspaceComponents,
  COMMON_ENV_PREFIX } from '@salto-io/workspace'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, CONFIG_DIR_NAME, getConfigDir } from '../app_config'
import { localState } from './state'
import { workspaceConfigSource } from './workspace_config'
import { buildLocalStaticFilesCache } from './static_files_cache'
import { createRemoteMapCreator } from './remote_map'

const { configSource } = cs
const { FILE_EXTENSION, naclFilesSource, ENVS_PREFIX } = nacl
const { createParseResultCache } = parseCache
const { buildStaticFilesSource } = staticFiles

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
  name: string,
  excludeDirs: string[] = []
): {
  naclFilesStore: dirStore.DirectoryStore<string>
  cache: parseCache.ParsedNaclFileCache
  staticFileSource: staticFiles.StaticFilesSource
} => {
  const dirPathToIgnore = (dirPath: string): boolean =>
    !(excludeDirs.concat(getConfigDir(sourceBaseDir))).includes(dirPath)

  const naclFilesStore = localDirectoryStore({
    baseDir: sourceBaseDir,
    name,
    encoding: 'utf8',
    fileFilter: `*${FILE_EXTENSION}`,
    directoryFilter: dirPathToIgnore,
  })

  const naclStaticFilesStore = localDirectoryStore({
    baseDir: path.join(sourceBaseDir),
    name,
    nameSuffix: STATIC_RESOURCES_FOLDER,
    directoryFilter: dirPathToIgnore,
  })

  const cacheName = name === COMMON_ENV_PREFIX ? 'common' : name
  const staticFileSource = buildStaticFilesSource(
    naclStaticFilesStore,
    buildLocalStaticFilesCache(cacheDir, cacheName),
  )
  return {
    naclFilesStore,
    cache: createParseResultCache(
      cacheName,
      createRemoteMapCreator(cacheDir),
      staticFileSource,
    ),
    staticFileSource,
  }
}

const loadNaclFileSource = (
  sourceBaseDir: string,
  cacheBaseDir: string,
  sourceName: string,
  excludeDirs: string[] = []
): Promise<nacl.NaclFilesSource> => {
  const { naclFilesStore, cache, staticFileSource } = getNaclFilesSourceParams(
    sourceBaseDir, cacheBaseDir, sourceName, excludeDirs
  )
  return naclFilesSource(
    sourceName, naclFilesStore, cache, staticFileSource, createRemoteMapCreator(cacheBaseDir)
  )
}


const getLocalEnvName = (env: string): string => (env === COMMON_ENV_PREFIX
  ? env
  : path.join(ENVS_PREFIX, env))

export const loadLocalElementsSources = async (
  baseDir: string,
  localStorage: string,
  envs: ReadonlyArray<string>,
  remoteMapCreator: remoteMap.RemoteMapCreator,
): Promise<EnvironmentsSources> => ({
  commonSourceName: COMMON_ENV_PREFIX,
  sources: {
    ..._.fromPairs(await Promise.all(envs.map(async env =>
      [
        env,
        {
          naclFiles: await loadNaclFileSource(
            baseDir,
            path.resolve(localStorage, CACHE_DIR_NAME),
            getLocalEnvName(env)
          ),
          state: localState(
            path.join(getConfigDir(baseDir), STATES_DIR_NAME, env),
            env,
            remoteMapCreator
          ),
        },
      ]))),
    [COMMON_ENV_PREFIX]: {
      naclFiles: await loadNaclFileSource(
        baseDir,
        path.resolve(localStorage, CACHE_DIR_NAME),
        getLocalEnvName(COMMON_ENV_PREFIX),
        [path.join(baseDir, ENVS_PREFIX)]
      ),
    },
  },
})

export const locateWorkspaceRoot = async (lookupDir: string): Promise<string|undefined> => {
  if (await exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
    return lookupDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateWorkspaceRoot(parentDir) : undefined
}

const credentialsSource = (localStorage: string): cs.ConfigSource =>
  configSource(localDirectoryStore({
    baseDir: localStorage,
    name: CREDENTIALS_CONFIG_PATH,
    encoding: 'utf8',
  }))

export const loadLocalWorkspace = async (
  lookupDir: string, configOverrides?: DetailedChange[],
): Promise<Workspace> => {
  const baseDir = await locateWorkspaceRoot(path.resolve(lookupDir))
  if (_.isUndefined(baseDir)) {
    throw new NotAWorkspaceError()
  }
  const workspaceConfig = await workspaceConfigSource(baseDir, undefined, configOverrides)
  const envs = (await workspaceConfig.getWorkspaceConfig()).envs.map(e => e.name)
  const credentials = credentialsSource(workspaceConfig.localStorage)
  const cacheDirName = path.join(workspaceConfig.localStorage, CACHE_DIR_NAME)
  const elemSources = await loadLocalElementsSources(
    baseDir, workspaceConfig.localStorage, envs, createRemoteMapCreator(cacheDirName)
  )
  const ws = await loadWorkspace(
    workspaceConfig, credentials, elemSources, createRemoteMapCreator(cacheDirName)
  )

  return {
    ...ws,
    renameEnvironment: async (envName: string, newEnvName: string): Promise<void> => (
      ws.renameEnvironment(envName, newEnvName, getLocalEnvName(newEnvName))
    ),
    demoteAll: async (): Promise<void> => {
      const envSources = Object.values(
        _.pickBy(elemSources.sources, (_src, key) => key !== elemSources.commonSourceName)
      )
      const allEnvSourcesEmpty = envSources.length === 1 && await envSources[0].naclFiles.isEmpty()
      if (allEnvSourcesEmpty) {
        const commonSource = elemSources.sources[elemSources.commonSourceName].naclFiles
        const { currentEnv } = (await workspaceConfig.getWorkspaceConfig())
        return commonSource.rename(getLocalEnvName(currentEnv))
      }
      return ws.demoteAll()
    },
    clear: async (args: Omit<WorkspaceComponents, 'serviceConfig'>) => {
      await ws.clear(args)
      const envsDir = path.join(baseDir, ENVS_PREFIX)
      if (await isEmptyDir.notFoundAsUndefined(envsDir)) {
        await rm(envsDir)
      }
    },
  }
}

export const initLocalWorkspace = async (baseDir: string, name?: string, envName = 'default'):
Promise<Workspace> => {
  const workspaceName = name ?? path.basename(path.resolve(baseDir))
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
  const remoteMapCreator = createRemoteMapCreator(path.join(localStorage, CACHE_DIR_NAME))
  const elemSources = await loadLocalElementsSources(
    path.resolve(baseDir),
    localStorage,
    [envName],
    remoteMapCreator
  )

  return initWorkspace(
    workspaceName,
    uid,
    envName,
    workspaceConfig,
    credentials,
    elemSources,
    remoteMapCreator
  )
}
