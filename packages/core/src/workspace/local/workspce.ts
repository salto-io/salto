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
import { InstanceElement } from '@salto-io/adapter-api'
import uuidv5 from 'uuid/v5'
import { getAdaptersCredentialsTypes } from '../../core/adapters'
import { exists } from '../../file'
import { Workspace, loadWorkspace, preferencesWorkspaceConfigType, COMMON_ENV_PREFIX, EnviornmentsSources, WORKSPACE_CONFIG, initWorkspace } from '../workspace'
import { configSource, ConfigSource } from '../config_source'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome } from '../../app_config'
import { BlueprintsSource, BP_EXTENSION, blueprintsSource } from '../blueprints/blueprints_source'
import { parseResultCache } from '../cache'
import { localState } from './state'

export const CONFIG_DIR_NAME = 'salto.config'
export const STATES_DIR_NAME = 'states'

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

const getConfigDir = (baseDir: string): string => (
  path.join(path.resolve(baseDir), CONFIG_DIR_NAME)
)

const loadBlueprintSource = (
  sourceBaseDir: string,
  localStorage: string,
  excludeDirs: string[] = []
): BlueprintsSource => {
  const blueprintsStore = localDirectoryStore(
    sourceBaseDir,
    `*${BP_EXTENSION}`,
    (dirParh: string) => !(excludeDirs.concat(getConfigDir(sourceBaseDir))).includes(dirParh),
  )
  const cacheStore = localDirectoryStore(path.join(localStorage, 'cache'))
  return blueprintsSource(blueprintsStore, parseResultCache(cacheStore))
}

const elementsSources = (baseDir: string, localStorage: string, envs: string[]):
EnviornmentsSources => ({
  ..._.fromPairs(envs.map(env =>
    [
      env,
      {
        blueprints: loadBlueprintSource(
          path.resolve(baseDir, env),
          path.resolve(localStorage, env)
        ),
        state: localState(path.join(getConfigDir(baseDir), STATES_DIR_NAME, `${env}.bpc`)),

      },
    ])),
  [COMMON_ENV_PREFIX]: {
    blueprints: loadBlueprintSource(
      baseDir,
      localStorage,
      envs.map(env => path.join(baseDir, env))
    ),
  },
})

const workspaceConfigSource = (baseConfigDir: string, localConfigDir: string): ConfigSource => {
  const repoConfigSource = configSource(localDirectoryStore(baseConfigDir))
  const localConfigSource = configSource(localDirectoryStore(localConfigDir))
  return {
    get: async (configName: string): Promise<InstanceElement | undefined> =>
      await repoConfigSource.get(configName) || localConfigSource.get(configName),
    set: (configName: string, config: Readonly<InstanceElement>): Promise<void> => {
      const locals = Object.values(getAdaptersCredentialsTypes())
        .concat(preferencesWorkspaceConfigType)
      if (locals.includes(config.type)) {
        return localConfigSource.set(configName, config)
      }
      return repoConfigSource.set(configName, config)
    },
  }
}

const locateWorkspaceRoot = async (lookupDir: string): Promise<string|undefined> => {
  if (await exists(path.join(lookupDir, CONFIG_DIR_NAME))) {
    return lookupDir
  }
  const parentDir = lookupDir.substr(0, lookupDir.lastIndexOf(path.sep))
  return parentDir ? locateWorkspaceRoot(parentDir) : undefined
}

export const loadLocalWorkspace = async (lookupDir: string):
Promise<Workspace> => {
  const baseDir = await locateWorkspaceRoot(path.resolve(lookupDir))
  if (_.isUndefined(baseDir)) {
    throw new NotAWorkspaceError()
  }
  const workspaceConfig = configSource(localDirectoryStore(getConfigDir(baseDir)))
  const conf = await workspaceConfig.get(WORKSPACE_CONFIG) as InstanceElement
  const localStorage = path.join(getSaltoHome(), `${conf.value.name}-${conf.value.uid}`)
  const envs = conf.value.envs.map((env: {name: string}) => env.name)
  return loadWorkspace(workspaceConfigSource(getConfigDir(baseDir), localStorage),
    elementsSources(baseDir, localStorage, envs))
}

export const initLocalWorkspace = async (baseDir: string, name?: string, envName = 'default'):
Promise<Workspace> => {
  const workspaceName = name || path.basename(path.resolve(baseDir))
  const uid = uuidv5(workspaceName, '1b671a64-40d5-491e-99b0-da01ff1f3341')
  const localStorage = path.join(getSaltoHome(), `${workspaceName}-${uid}`)
  if (await locateWorkspaceRoot(path.resolve(baseDir))) {
    throw new ExistingWorkspaceError()
  }
  if (await exists(localStorage)) {
    throw new NotAnEmptyWorkspaceError([localStorage])
  }

  return initWorkspace(workspaceName, uid, envName,
    workspaceConfigSource(getConfigDir(baseDir), localStorage),
    elementsSources(path.resolve(baseDir), localStorage, [envName]))
}
