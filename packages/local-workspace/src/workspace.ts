/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Adapter, DetailedChange, ObjectType } from '@salto-io/adapter-api'
import { exists, isEmptyDir, rm } from '@salto-io/file'
import {
  Workspace,
  loadWorkspace,
  EnvironmentsSources,
  initWorkspace,
  nacl,
  remoteMap,
  configSource as cs,
  staticFiles,
  dirStore,
  WorkspaceComponents,
  errors,
  COMMON_ENV_PREFIX,
  isValidEnvName,
  EnvironmentSource,
  EnvConfig,
  buildStaticFilesCache,
  getBaseDirFromEnvName,
  getStaticFileCacheName,
  WorkspaceGetCustomReferencesFunc,
  elementSource,
  adaptersConfigSource,
  createAdapterReplacedID,
} from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { getSubtypes } from '@salto-io/adapter-utils'
import { localDirectoryStore, createExtensionFileFilter } from './dir_store'
import { CONFIG_DIR_NAME, getLocalStoragePath } from './app_config'
import { loadState } from './state'
import { workspaceConfigSource } from './workspace_config'
import { createRemoteMapCreator } from './remote_map'
import { buildLocalAdaptersConfigSource } from './adapters_config'
import { WorkspaceMetadataConfig } from './workspace_config_types'

const { configSource } = cs
const { FILE_EXTENSION, naclFilesSource, ENVS_PREFIX } = nacl
const { buildStaticFilesSource } = staticFiles
const log = logger(module)
const { awu } = collections.asynciterable

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
  name: string
  remoteMapCreator: remoteMap.RemoteMapCreator
  persistent: boolean
  excludeDirs?: string[]
}

const getNaclFilesSourceParams = ({
  sourceBaseDir,
  name,
  remoteMapCreator,
  persistent,
  excludeDirs = [],
}: GetNaclFilesSourceParamsArgs): {
  naclFilesStore: dirStore.DirectoryStore<string>
  staticFileSource: staticFiles.StaticFilesSource
} => {
  const dirPathToIgnore = (dirPath: string): boolean =>
    !excludeDirs.concat(path.join(path.resolve(sourceBaseDir), CONFIG_DIR_NAME)).includes(dirPath)

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

  const staticFileSource = buildStaticFilesSource(
    naclStaticFilesStore,
    buildStaticFilesCache(getStaticFileCacheName(name), remoteMapCreator, persistent),
  )
  return {
    naclFilesStore,
    staticFileSource,
  }
}

const loadNaclFileSource = async (
  sourceBaseDir: string,
  sourceName: string,
  persistent: boolean,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  excludeDirs: string[] = [],
): Promise<nacl.NaclFilesSource> => {
  const { naclFilesStore, staticFileSource } = getNaclFilesSourceParams({
    sourceBaseDir,
    name: sourceName,
    remoteMapCreator,
    persistent,
    excludeDirs,
  })
  return naclFilesSource(sourceName, naclFilesStore, staticFileSource, remoteMapCreator, persistent)
}

export const createEnvironmentSource = async ({
  env,
  baseDir,
  remoteMapCreator,
  stateStaticFilesSource,
  persistent,
  workspaceConfig,
}: {
  env: string
  baseDir: string
  remoteMapCreator: remoteMap.RemoteMapCreator
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  persistent: boolean
  workspaceConfig: WorkspaceMetadataConfig
}): Promise<EnvironmentSource> => {
  log.debug('Creating environment source for %s at %s', env, baseDir)
  return {
    naclFiles: await loadNaclFileSource(baseDir, getBaseDirFromEnvName(env), persistent, remoteMapCreator),
    state: loadState({
      workspaceId: workspaceConfig.uid,
      stateConfig: workspaceConfig.state,
      baseDir: path.join(path.resolve(baseDir), CONFIG_DIR_NAME, STATES_DIR_NAME, env),
      envName: env,
      remoteMapCreator,
      persistent,
      staticFilesSource: stateStaticFilesSource,
    }),
  }
}

export const loadLocalElementsSources = async ({
  baseDir,
  envs,
  remoteMapCreator,
  stateStaticFilesSource,
  workspaceConfig,
  persistent = true,
}: {
  baseDir: string
  envs: ReadonlyArray<string>
  remoteMapCreator: remoteMap.RemoteMapCreator
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  workspaceConfig: WorkspaceMetadataConfig
  persistent?: boolean
}): Promise<EnvironmentsSources> => ({
  commonSourceName: COMMON_ENV_PREFIX,
  sources: {
    ..._.fromPairs(
      await Promise.all(
        envs.map(async env => [
          env,
          await createEnvironmentSource({
            env,
            baseDir,
            remoteMapCreator,
            persistent,
            stateStaticFilesSource,
            workspaceConfig,
          }),
        ]),
      ),
    ),
    [COMMON_ENV_PREFIX]: {
      naclFiles: await loadNaclFileSource(
        baseDir,
        getBaseDirFromEnvName(COMMON_ENV_PREFIX),
        persistent,
        remoteMapCreator,
        [path.join(baseDir, ENVS_PREFIX)],
      ),
    },
  },
})

export const locateWorkspaceRoot = async (lookupDir: string): Promise<string | undefined> => {
  if (await exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
    return lookupDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateWorkspaceRoot(parentDir) : undefined
}

const credentialsSource = (localStorage: string): cs.ConfigSource =>
  configSource(
    localDirectoryStore({
      baseDir: localStorage,
      name: CREDENTIALS_CONFIG_PATH,
      encoding: 'utf8',
    }),
  )

type LoadLocalWorkspaceArgs = {
  path: string
  configOverrides?: DetailedChange[]
  persistent?: boolean
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  credentialSource?: cs.ConfigSource
  ignoreFileChanges?: boolean
  getConfigTypes?: (envs: EnvConfig[], adapterCreators?: Record<string, Adapter>) => Promise<ObjectType[]>
  getCustomReferences?: WorkspaceGetCustomReferencesFunc
  adapterCreators: Record<string, Adapter>
}

const getAdapterConfigsPerAccount = async (
  envs: EnvConfig[],
  adapterCreators: Record<string, Adapter>,
): Promise<ObjectType[]> => {
  const configTypesByAccount = Object.fromEntries(
    Object.entries(
      _.mapValues(adapterCreators, adapterCreator =>
        adapterCreator.configType ? [adapterCreator.configType, ...getSubtypes([adapterCreator.configType], true)] : [],
      ),
    ).filter(entry => entry[1].length > 0),
  )
  const configElementSource = elementSource.createInMemoryElementSource(Object.values(configTypesByAccount).flat())
  const differentlyNamedAccounts = Object.fromEntries(
    envs
      .flatMap(env => Object.entries(env.accountToServiceName ?? {}))
      .filter(([accountName, serviceName]) => accountName !== serviceName),
  )
  await awu(Object.keys(differentlyNamedAccounts)).forEach(async account => {
    const adapter = differentlyNamedAccounts[account]
    const adapterConfigs = configTypesByAccount[adapter]
    const additionalConfigs = await adaptersConfigSource.calculateAdditionalConfigTypes(
      configElementSource,
      adapterConfigs.map(conf => createAdapterReplacedID(conf.elemID, account)),
      adapter,
      account,
    )
    configTypesByAccount[account] = additionalConfigs
  })
  return Object.values(configTypesByAccount).flat()
}

export async function loadLocalWorkspace({
  path: lookupDir,
  configOverrides,
  persistent = true,
  credentialSource,
  stateStaticFilesSource,
  ignoreFileChanges = false,
  getConfigTypes,
  getCustomReferences,
  adapterCreators,
}: LoadLocalWorkspaceArgs): Promise<Workspace> {
  const baseDir = await locateWorkspaceRoot(path.resolve(lookupDir))
  const getConfigTypesFunc = getConfigTypes ?? getAdapterConfigsPerAccount
  if (_.isUndefined(baseDir)) {
    throw new NotAWorkspaceError()
  }

  const workspaceConfigSrc = await workspaceConfigSource(baseDir, undefined)
  const workspaceConfig = await workspaceConfigSrc.getWorkspaceConfig()
  const cacheDirName = path.join(workspaceConfigSrc.localStorage, CACHE_DIR_NAME)
  const remoteMapCreator = createRemoteMapCreator(cacheDirName)
  try {
    const adaptersConfig = await buildLocalAdaptersConfigSource(
      baseDir,
      remoteMapCreator,
      persistent,
      await getConfigTypesFunc(workspaceConfig.envs, adapterCreators),
      configOverrides,
    )
    const envNames = workspaceConfig.envs.map(e => e.name)
    const credentials = credentialSource ?? credentialsSource(workspaceConfigSrc.localStorage)

    const elemSources = await loadLocalElementsSources({
      baseDir,
      envs: envNames,
      remoteMapCreator,
      stateStaticFilesSource,
      persistent,
      workspaceConfig,
    })
    const ws = await loadWorkspace({
      config: workspaceConfigSrc,
      adaptersConfig,
      credentials,
      environmentsSources: elemSources,
      remoteMapCreator,
      ignoreFileChanges,
      persistent,
      mergedRecoveryMode: undefined,
      getCustomReferences,
      adapterCreators,
    })

    return {
      ...ws,
      renameEnvironment: async (envName: string, newEnvName: string): Promise<void> =>
        ws.renameEnvironment(envName, newEnvName, getBaseDirFromEnvName(newEnvName)),
      demoteAll: async (): Promise<void> => {
        const envSources = Object.values(
          _.pickBy(elemSources.sources, (_src, key) => key !== elemSources.commonSourceName),
        )
        const allEnvSourcesEmpty = envSources.length === 1 && (await envSources[0].naclFiles.isEmpty())
        if (allEnvSourcesEmpty) {
          const commonSource = elemSources.sources[elemSources.commonSourceName].naclFiles
          const currentEnv = ws.currentEnv()
          return commonSource.rename(getBaseDirFromEnvName(currentEnv))
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
  } catch (e) {
    try {
      await remoteMapCreator.close()
    } catch (closeError) {
      log.error('remoteMapCreator close threw an error: %o. Ignoring it, and rethrowing the original error', closeError)
    }
    throw e
  }
}

type InitLocalWorkspaceParams = {
  baseDir: string
  envName?: string
  configTypes: ObjectType[]
  getCustomReferences?: WorkspaceGetCustomReferencesFunc
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  adapterCreators: Record<string, Adapter>
}

const getInitLocalWorkspace: (
  baseDirOrParams: string | InitLocalWorkspaceParams,
  envName?: string,
  configTypes?: ObjectType[],
  getCustomReferences?: WorkspaceGetCustomReferencesFunc,
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource,
) => InitLocalWorkspaceParams = (
  baseDirOrParams,
  envName,
  configTypes,
  getCustomReferences,
  stateStaticFilesSource,
) => {
  if (!_.isString(baseDirOrParams)) {
    return baseDirOrParams
  }
  if (configTypes === undefined) {
    throw new Error('configTypes cannot be undefined')
  }
  return {
    baseDir: baseDirOrParams,
    envName,
    configTypes,
    getCustomReferences,
    stateStaticFilesSource,
    adapterCreators: {},
  }
}

export function initLocalWorkspace(args: InitLocalWorkspaceParams): Promise<Workspace>
export function initLocalWorkspace(
  baseDir: string,
  envName: string,
  configTypes: ObjectType[],
  getCustomReferences?: WorkspaceGetCustomReferencesFunc,
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource,
): Promise<Workspace>

export async function initLocalWorkspace(
  inputBaseDir: string | InitLocalWorkspaceParams,
  inputEnvName = 'default',
  inputConfigTypes?: ObjectType[],
  inputGetCustomReferences?: WorkspaceGetCustomReferencesFunc,
  inputStateStaticFilesSource?: staticFiles.StateStaticFilesSource,
): Promise<Workspace> {
  const {
    baseDir,
    envName = 'default',
    adapterCreators,
    configTypes,
    getCustomReferences,
    stateStaticFilesSource,
  } = getInitLocalWorkspace(
    inputBaseDir,
    inputEnvName,
    inputConfigTypes,
    inputGetCustomReferences,
    inputStateStaticFilesSource,
  )
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

  const workspaceConfigSrc = await workspaceConfigSource(baseDir, localStorage)
  const remoteMapCreator = createRemoteMapCreator(path.join(localStorage, CACHE_DIR_NAME))
  try {
    const persistentMode = true

    const adaptersConfig = await buildLocalAdaptersConfigSource(baseDir, remoteMapCreator, persistentMode, configTypes)
    const credentials = credentialsSource(localStorage)

    const elemSources = await loadLocalElementsSources({
      baseDir: path.resolve(baseDir),
      envs: [envName],
      remoteMapCreator,
      stateStaticFilesSource,
      persistent: persistentMode,
      workspaceConfig: { uid },
    })

    const workspace = await initWorkspace({
      uid,
      defaultEnvName: envName,
      config: workspaceConfigSrc,
      adaptersConfig,
      credentials,
      envs: elemSources,
      remoteMapCreator,
      getCustomReferences,
      adapterCreators,
    })
    return workspace
  } catch (e) {
    try {
      await remoteMapCreator.close()
    } catch (closeError) {
      log.error('remoteMapCreator close threw an error: %o. Ignoring it, and rethrowing the original error', closeError)
    }
    throw e
  }
}
