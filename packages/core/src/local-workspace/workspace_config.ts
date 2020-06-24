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
import { workspaceConfigSource as wcs,
  WorkspaceConfig, configSource } from '@salto-io/workspace'
import { InstanceElement } from '@salto-io/adapter-api'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, CONFIG_DIR_NAME } from '../app_config'
import { WORKSPACE_CONFIG_NAME, ENVS_CONFIG_NAME, EnvsConfig,
  USER_CONFIG_NAME, UserDataConfig, WorkspaceMetadataConfig, envsConfigInstance,
  userDataConfigInstance, workspaceMetadataConfigInstance, ADAPTERS_CONFIG_NAME } from './workspace_config_types'
import { NoWorkspaceConfig, NoEnvsConfig } from './errors'

export const getConfigDir = (baseDir: string): string => (
  path.join(path.resolve(baseDir), CONFIG_DIR_NAME)
)

export type WorkspaceConfigSource = wcs.WorkspaceConfigSource & {
  localStorage: string
}

export const workspaceConfigSource = async (baseDir: string, localStorage?: string):
Promise<WorkspaceConfigSource> => {
  const repoCs = configSource.configSource(localDirectoryStore(getConfigDir(baseDir)))
  const workspaceConf = (await repoCs.get(WORKSPACE_CONFIG_NAME))?.value

  if (_.isUndefined(workspaceConf) && _.isUndefined(localStorage)) {
    throw new Error('Cannot locate local storage directory')
  }

  const computedLocalStorage = localStorage
  || path.join(getSaltoHome(), `${workspaceConf?.name}-${workspaceConf?.uid}`)
  const localCs = configSource.configSource(localDirectoryStore(computedLocalStorage))
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
    getAdapter: (adapter: string): Promise<InstanceElement | undefined> =>
      repoCs.get(path.join(ADAPTERS_CONFIG_NAME, adapter)),
    setAdapter: async (adapter: string, config: Readonly<InstanceElement>): Promise<void> =>
      repoCs.set(path.join(ADAPTERS_CONFIG_NAME, adapter), config)
    ,
  }
}
