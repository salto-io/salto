/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { v4 as uuidv4 } from 'uuid'
import { DetailedChange, ObjectType, ReferenceInfo, Element } from '@salto-io/adapter-api'
import { exists, isEmptyDir, rm } from '@salto-io/file'
import { Workspace, loadWorkspace, EnvironmentsSources, initWorkspace, nacl, remoteMap,
  configSource as cs, staticFiles, dirStore, WorkspaceComponents, errors, elementSource,
  COMMON_ENV_PREFIX, isValidEnvName, EnvironmentSource, EnvConfig, adaptersConfigSource,
  createAdapterReplacedID, state } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { localDirectoryStore, createExtensionFileFilter } from './dir_store'
import { CONFIG_DIR_NAME, getLocalStoragePath } from '../app_config'
import { localState } from './state'
import { workspaceConfigSource } from './workspace_config'
import { buildLocalStaticFilesCache } from './static_files_cache'
import { createRemoteMapCreator } from './remote_map'
import { adapterCreators, getAdaptersConfigTypesMap } from '../core/adapters'
import { buildLocalAdaptersConfigSource } from './adapters_config'

const { awu } = collections.asynciterable
const { configSource } = cs
const { FILE_EXTENSION, naclFilesSource, ENVS_PREFIX } = nacl
const { buildStaticFilesSource } = staticFiles
const log = logger(module)

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

type GetNaclFilesSourceParamsArgs = {
  sourceBaseDir: string
  cacheDir: string
  name: string
  remoteMapCreator: remoteMap.RemoteMapCreator
  persistent: boolean
  excludeDirs?: string[]
}

const getNaclFilesSourceParams = ({
  sourceBaseDir,
  cacheDir,
  name,
  remoteMapCreator,
  persistent,
  excludeDirs = [],
}: GetNaclFilesSourceParamsArgs): {
  naclFilesStore: dirStore.DirectoryStore<string>
  staticFileSource: staticFiles.StaticFilesSource
} => {
  const dirPathToIgnore = (dirPath: string): boolean =>
    !(excludeDirs.concat(path.join(path.resolve(sourceBaseDir), CONFIG_DIR_NAME))).includes(dirPath)

  const naclFilesStore = localDirectoryStore({
    baseDir: sourceBaseDir,
    name,
    encoding: 'utf8',
    fileFilter: createExtensionFileFilter(FILE_EXTENSION),
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
    buildLocalStaticFilesCache(cacheDir, cacheName, remoteMapCreator, persistent),
  )
  return {
    naclFilesStore,
    staticFileSource,
  }
}

const loadNaclFileSource = async (
  sourceBaseDir: string,
  cacheBaseDir: string,
  sourceName: string,
  persistent: boolean,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  excludeDirs: string[] = []
): Promise<nacl.NaclFilesSource> => {
  const { naclFilesStore, staticFileSource } = getNaclFilesSourceParams({
    sourceBaseDir,
    cacheDir: cacheBaseDir,
    name: sourceName,
    remoteMapCreator,
    persistent,
    excludeDirs,
  })
  return naclFilesSource(
    sourceName,
    naclFilesStore,
    staticFileSource,
    remoteMapCreator,
    persistent
  )
}


const getLocalEnvName = (env: string): string => (env === COMMON_ENV_PREFIX
  ? env
  : path.join(ENVS_PREFIX, env))

export const createEnvironmentSource = async ({
  env, baseDir, localStorage, remoteMapCreator, stateStaticFilesSource, persistent,
}: {
  env: string
  baseDir: string
  localStorage: string
  remoteMapCreator: remoteMap.RemoteMapCreator
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  persistent: boolean
}): Promise<EnvironmentSource> => {
  log.debug('Creating environment source for %s at %s', env, baseDir)
  return {
    naclFiles: await loadNaclFileSource(
      baseDir,
      path.resolve(localStorage, CACHE_DIR_NAME),
      getLocalEnvName(env),
      persistent,
      remoteMapCreator,
    ),
    state: localState(
      path.join(path.resolve(baseDir), CONFIG_DIR_NAME, STATES_DIR_NAME, env),
      env,
      remoteMapCreator,
      stateStaticFilesSource ?? state.buildOverrideStateStaticFilesSource(localDirectoryStore({
        baseDir: path.resolve(localStorage, STATIC_RESOURCES_FOLDER),
        name: env,
      })),
      persistent
    ),
  }
}

export const loadLocalElementsSources = async ({
  baseDir,
  localStorage,
  envs,
  remoteMapCreator,
  stateStaticFilesSource,
  persistent = true,
}: {
  baseDir: string
  localStorage: string
  envs: ReadonlyArray<string>
  remoteMapCreator: remoteMap.RemoteMapCreator
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  persistent?: boolean
}): Promise<EnvironmentsSources> => ({
  commonSourceName: COMMON_ENV_PREFIX,
  sources: {
    ..._.fromPairs(await Promise.all(envs.map(async env =>
      [
        env,
        await createEnvironmentSource({
          env, baseDir, localStorage, remoteMapCreator, persistent, stateStaticFilesSource,
        }),
      ]))),
    [COMMON_ENV_PREFIX]: {
      naclFiles: await loadNaclFileSource(
        baseDir,
        path.resolve(localStorage, CACHE_DIR_NAME),
        getLocalEnvName(COMMON_ENV_PREFIX),
        persistent,
        remoteMapCreator,
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

export const getAdapterConfigsPerAccount = async (envs: EnvConfig[]): Promise<ObjectType[]> => {
  const configTypesByAccount = await getAdaptersConfigTypesMap()
  const configElementSource = elementSource.createInMemoryElementSource(
    Object.values(configTypesByAccount).flat()
  )
  const differentlyNamedAccounts = Object.fromEntries(envs
    .flatMap(env => Object.entries(env.accountToServiceName ?? {}))
    .filter(([accountName, serviceName]) => accountName !== serviceName))
  await awu(Object.keys(differentlyNamedAccounts)).forEach(async account => {
    const adapter = differentlyNamedAccounts[account]
    const adapterConfigs = configTypesByAccount[adapter]
    const additionalConfigs = await adaptersConfigSource.calculateAdditionalConfigTypes(
      configElementSource, adapterConfigs
        .map(conf => createAdapterReplacedID(conf.elemID, account)), adapter, account
    )
    configTypesByAccount[account] = additionalConfigs
  })
  return Object.values(configTypesByAccount).flat()
}

export const getCustomReferences = async (
  elements: Element[],
  accountToServiceName: Record<string, string>,
): Promise<ReferenceInfo[]> => {
  const accountToElements = _.groupBy(elements.filter(e => e.elemID.adapter !== ''), e => e.elemID.adapter)
  return (await Promise.all(Object.entries(accountToElements).map(([account, accountElements]) => {
    const serviceName = accountToServiceName[account] ?? account
    return adapterCreators[serviceName].getCustomReferences?.(accountElements) ?? []
  }))).flat()
}


type LoadLocalWorkspaceArgs = {
  path: string
  configOverrides?: DetailedChange[]
  persistent?: boolean
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  credentialSource?: cs.ConfigSource
}

const loadLocalWorkspaceImpl = async ({
  path: lookupDir,
  configOverrides,
  persistent = true,
  credentialSource,
  stateStaticFilesSource,
}: LoadLocalWorkspaceArgs): Promise<Workspace> => {
  const baseDir = await locateWorkspaceRoot(path.resolve(lookupDir))
  if (_.isUndefined(baseDir)) {
    throw new NotAWorkspaceError()
  }

  const workspaceConfig = await workspaceConfigSource(baseDir, undefined)
  const { envs } = await workspaceConfig.getWorkspaceConfig()
  const cacheDirName = path.join(workspaceConfig.localStorage, CACHE_DIR_NAME)
  const remoteMapCreator = createRemoteMapCreator(cacheDirName)
  const adaptersConfig = await buildLocalAdaptersConfigSource(
    baseDir,
    workspaceConfig.localStorage,
    remoteMapCreator,
    persistent,
    await getAdapterConfigsPerAccount(envs),
    configOverrides,
  )
  const envNames = envs.map(e => e.name)
  const credentials = credentialSource ?? credentialsSource(workspaceConfig.localStorage)

  const elemSources = await loadLocalElementsSources({
    baseDir,
    localStorage: workspaceConfig.localStorage,
    envs: envNames,
    remoteMapCreator,
    stateStaticFilesSource,
    persistent,
  })
  const ws = await loadWorkspace(
    workspaceConfig,
    adaptersConfig,
    credentials,
    elemSources,
    remoteMapCreator,
    getCustomReferences,
    false,
    persistent,
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
        const currentEnv = ws.currentEnv()
        return commonSource.rename(getLocalEnvName(currentEnv))
      }
      return ws.demoteAll()
    },
    clear: async (clearArgs: Omit<WorkspaceComponents, 'accountConfig'>) => {
      await ws.clear(clearArgs)
      const envsDir = path.join(baseDir, ENVS_PREFIX)
      if (await isEmptyDir.notFoundAsUndefined(envsDir)) {
        await rm(envsDir)
      }
    },
  }
}

// As a transitionary step, we support both a string input and an argument object
export function loadLocalWorkspace(args: LoadLocalWorkspaceArgs): Promise<Workspace>
// @deprecated
export function loadLocalWorkspace(
  lookupDir: string,
  configOverrides?: DetailedChange[],
  persistent?: boolean,
): Promise<Workspace>

export async function loadLocalWorkspace(
  args: string | LoadLocalWorkspaceArgs,
  configOverrides?: DetailedChange[],
  persistent = true,
): Promise<Workspace> {
  if (_.isString(args)) {
    log.warn('Using deprecated argument format for loadLocalWorkspace, this type of call will be deprecated soon. please pass an arguments object instead')
    return loadLocalWorkspaceImpl({ path: args, configOverrides, persistent })
  }
  return loadLocalWorkspaceImpl(args)
}

export const initLocalWorkspace = async (
  baseDir: string,
  name?: string,
  envName = 'default',
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource,
):
Promise<Workspace> => {
  const workspaceName = name ?? path.basename(path.resolve(baseDir))
  const uid = uuidv4()
  const localStorage = getLocalStoragePath(uid)
  if (await locateWorkspaceRoot(path.resolve(baseDir))) {
    throw new ExistingWorkspaceError()
  }
  if (await exists(localStorage)) {
    throw new NotAnEmptyWorkspaceError([localStorage])
  }
  if (!isValidEnvName(envName)) {
    throw new errors.InvalidEnvNameError(envName)
  }

  const workspaceConfig = await workspaceConfigSource(baseDir, localStorage)
  const remoteMapCreator = createRemoteMapCreator(path.join(localStorage, CACHE_DIR_NAME))
  const persistentMode = true

  const adaptersConfig = await buildLocalAdaptersConfigSource(
    baseDir,
    localStorage,
    remoteMapCreator,
    persistentMode,
    Object.values(await getAdaptersConfigTypesMap()).flat(),
  )
  const credentials = credentialsSource(localStorage)

  const elemSources = await loadLocalElementsSources({
    baseDir: path.resolve(baseDir),
    localStorage,
    envs: [envName],
    remoteMapCreator,
    stateStaticFilesSource,
    persistent: persistentMode,
  })

  return initWorkspace(
    workspaceName,
    uid,
    envName,
    workspaceConfig,
    adaptersConfig,
    credentials,
    elemSources,
    remoteMapCreator,
    getCustomReferences,
  )
}
