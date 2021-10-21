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
import { logger } from '@salto-io/logging'
import { workspaceConfigSource as wcs,
  WorkspaceConfig, configSource } from '@salto-io/workspace'
import * as fileUtils from '@salto-io/file'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, CONFIG_DIR_NAME } from '../app_config'
import { WORKSPACE_CONFIG_NAME, ENVS_CONFIG_NAME, EnvsConfig,
  USER_CONFIG_NAME, UserDataConfig, WorkspaceMetadataConfig, envsConfigInstance,
  userDataConfigInstance, workspaceMetadataConfigInstance } from './workspace_config_types'
import { NoWorkspaceConfig, NoEnvsConfig } from './errors'

const log = logger(module)

export type WorkspaceConfigSource = wcs.WorkspaceConfigSource & {
  localStorage: string
}

export const getLocalStorage = async (workspaceName: string, uid: string): Promise<string> => {
  const computedLocalStorage = path.join(getSaltoHome(), `${uid}`)
  const deprecatedLocalStorage = path.join(getSaltoHome(), `${workspaceName}-${uid}`)

  if (!await fileUtils.exists(computedLocalStorage)) {
    if (await fileUtils.exists(deprecatedLocalStorage)) {
      log.warn(`Found deprecated localStorage on ${deprecatedLocalStorage}. Moving it to ${computedLocalStorage}.`)
      await fileUtils.rename(deprecatedLocalStorage, computedLocalStorage)
    }
  }

  return computedLocalStorage
}

export const workspaceConfigSource = async (
  baseDir: string, localStorage?: string
): Promise<WorkspaceConfigSource> => {
  const repoCs = configSource.configSource(
    localDirectoryStore({ baseDir, name: CONFIG_DIR_NAME, encoding: 'utf8' }),
  )
  const workspaceConf = (await repoCs.get(WORKSPACE_CONFIG_NAME))?.value

  if (_.isUndefined(workspaceConf) && _.isUndefined(localStorage)) {
    throw new Error('Cannot locate local storage directory')
  }

  const computedLocalStorage = localStorage
  || await getLocalStorage(workspaceConf?.name, workspaceConf?.uid)
  const localCs = configSource.configSource(
    localDirectoryStore({ baseDir: computedLocalStorage, name: '', encoding: 'utf8' }),
  )

  return {
    localStorage: computedLocalStorage,
    getWorkspaceConfig: async (): Promise<WorkspaceConfig> => {
      const envs = (await repoCs.get(ENVS_CONFIG_NAME))?.value as EnvsConfig
      const userData = (await localCs.get(USER_CONFIG_NAME))?.value as UserDataConfig
      const workspaceMetadata = (
        await repoCs.get(WORKSPACE_CONFIG_NAME)
      )?.value as WorkspaceMetadataConfig
      if (_.isUndefined(workspaceMetadata)) {
        throw new NoWorkspaceConfig()
      }
      if (_.isUndefined(envs)) {
        throw new NoEnvsConfig()
      }
      return {
        ...envs,
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
      })
      await repoCs.set(ENVS_CONFIG_NAME, envsInstance)
      await repoCs.set(WORKSPACE_CONFIG_NAME, workspaceMetadata)
      await localCs.set(USER_CONFIG_NAME, userData)
    },
  }
}
