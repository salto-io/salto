/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { Value } from '@salto-io/adapter-api'
import { workspaceConfigSource as wcs, WorkspaceConfig, configSource } from '@salto-io/workspace'
import { exists, rename } from '@salto-io/file'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, getLocalStoragePath, CONFIG_DIR_NAME } from '../app_config'
import {
  WORKSPACE_CONFIG_NAME,
  ENVS_CONFIG_NAME,
  USER_CONFIG_NAME,
  UserDataConfig,
  WorkspaceMetadataConfig,
  envsConfigInstance,
  userDataConfigInstance,
  workspaceMetadataConfigInstance,
} from './workspace_config_types'
import { NoWorkspaceConfig, NoEnvsConfig } from './errors'

const log = logger(module)

export type WorkspaceConfigSource = wcs.WorkspaceConfigSource & {
  localStorage: string
}

export const getLocalStorage = async (workspaceName: string, uid: string): Promise<string> => {
  const computedLocalStorage = getLocalStoragePath(uid)
  const deprecatedLocalStorage = path.join(getSaltoHome(), `${workspaceName}-${uid}`)

  if (!(await exists(computedLocalStorage))) {
    if (await exists(deprecatedLocalStorage)) {
      log.warn(`Found deprecated localStorage on ${deprecatedLocalStorage}. Moving it to ${computedLocalStorage}.`)
      await rename(deprecatedLocalStorage, computedLocalStorage)
    }
  }

  return computedLocalStorage
}

export const workspaceConfigSource = async (baseDir: string, localStorage?: string): Promise<WorkspaceConfigSource> => {
  const repoCs = configSource.configSource(localDirectoryStore({ baseDir, name: CONFIG_DIR_NAME, encoding: 'utf8' }))
  const workspaceConf = (await repoCs.get(WORKSPACE_CONFIG_NAME))?.value

  if (_.isUndefined(workspaceConf) && _.isUndefined(localStorage)) {
    throw new Error('Cannot locate local storage directory')
  }

  const computedLocalStorage = localStorage || (await getLocalStorage(workspaceConf?.name, workspaceConf?.uid))
  const localCs = configSource.configSource(
    localDirectoryStore({ baseDir: computedLocalStorage, name: '', encoding: 'utf8' }),
  )

  return {
    localStorage: computedLocalStorage,
    getWorkspaceConfig: async (): Promise<WorkspaceConfig> => {
      const workspaceMetadata = (await repoCs.get(WORKSPACE_CONFIG_NAME))?.value as WorkspaceMetadataConfig
      if (_.isUndefined(workspaceMetadata)) {
        throw new NoWorkspaceConfig()
      }
      const envs = (await repoCs.get(ENVS_CONFIG_NAME))?.value
      if (_.isUndefined(envs)) {
        throw new NoEnvsConfig()
      }
      // Fix env in case configuration is deprecated, before multiple accounts refactor SALTO-1264
      const fixedEnvs = envs.envs.map((env: Value) => {
        if (env.services) {
          return {
            accountToServiceName: Object.fromEntries(env.services.map((service: string) => [service, service])),
            name: env.name,
          }
        }
        return env
      })
      const userData = (await localCs.get(USER_CONFIG_NAME))?.value as UserDataConfig
      return {
        envs: fixedEnvs,
        ...userData,
        ...workspaceMetadata,
      }
    },
    setWorkspaceConfig: async (config: WorkspaceConfig): Promise<void> => {
      const envsInstance = envsConfigInstance({ envs: config.envs })
      const userData = userDataConfigInstance({ currentEnv: config.currentEnv })
      const workspaceMetadata = workspaceMetadataConfigInstance({
        uid: config.uid,
        name: config.name,
        staleStateThresholdMinutes: config.staleStateThresholdMinutes,
        state: config.state,
      })
      await repoCs.set(ENVS_CONFIG_NAME, envsInstance)
      await repoCs.set(WORKSPACE_CONFIG_NAME, workspaceMetadata)
      await localCs.set(USER_CONFIG_NAME, userData)
    },
  }
}
