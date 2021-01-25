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
import { workspaceConfigSource as wcs,
  WorkspaceConfig, configSource } from '@salto-io/workspace'
import { InstanceElement, DetailedChange, ElemID } from '@salto-io/adapter-api'
import wu from 'wu'
import { setPath } from '@salto-io/adapter-utils'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome, CONFIG_DIR_NAME } from '../app_config'
import { WORKSPACE_CONFIG_NAME, ENVS_CONFIG_NAME, EnvsConfig,
  USER_CONFIG_NAME, UserDataConfig, WorkspaceMetadataConfig, envsConfigInstance,
  userDataConfigInstance, workspaceMetadataConfigInstance, ADAPTERS_CONFIG_NAME } from './workspace_config_types'
import { NoWorkspaceConfig, NoEnvsConfig } from './errors'
import { getPlan, Plan } from '../core/plan'

export type WorkspaceConfigSource = wcs.WorkspaceConfigSource & {
  localStorage: string
}

export const workspaceConfigSource = async (
  baseDir: string, localStorage?: string, configOverrides: DetailedChange[] = []
): Promise<WorkspaceConfigSource> => {
  const repoCs = configSource.configSource(
    localDirectoryStore({ baseDir, name: CONFIG_DIR_NAME, encoding: 'utf8' }),
    configOverrides,
  )
  const workspaceConf = (await repoCs.get(WORKSPACE_CONFIG_NAME))?.value

  if (_.isUndefined(workspaceConf) && _.isUndefined(localStorage)) {
    throw new Error('Cannot locate local storage directory')
  }

  const computedLocalStorage = localStorage
  || path.join(getSaltoHome(), `${workspaceConf?.name}-${workspaceConf?.uid}`)
  const localCs = configSource.configSource(
    localDirectoryStore({ baseDir: computedLocalStorage, name: '', encoding: 'utf8' }),
    configOverrides,
  )

  const validateConfigChanges = (configChanges: Plan): void => {
    const updatedConfigFields = wu(configChanges.itemsByEvalOrder())
      .map(item => item.detailedChanges())
      .flatten()
      .map(detailedChange => detailedChange.id.getFullName())
      .toArray()

    const overiddenConfigFields = configOverrides.map(override => override.id.getFullName())

    const updatedOverriddenFields = overiddenConfigFields.filter(
      overiddenField => updatedConfigFields.some(updatedField =>
        updatedField.startsWith(overiddenField) || overiddenField.startsWith(updatedField))
    )

    if (updatedOverriddenFields.length !== 0) {
      // This is to remove the _config.instance._config from the field
      const fieldsToPrint = updatedOverriddenFields
        .map(ElemID.fromFullName)
        .map(id => [id.adapter, ...id.getFullNameParts().slice(4)].join('.'))
      throw new Error(`cannot update fields that were overriden by the user: ${fieldsToPrint}`)
    }
  }

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
    setAdapter: async (adapter: string, config: Readonly<InstanceElement>): Promise<void> => {
      const currConf = await repoCs.get(path.join(ADAPTERS_CONFIG_NAME, adapter))
      // Could happen at the initialization of a service.
      if (currConf === undefined) {
        await repoCs.set(path.join(ADAPTERS_CONFIG_NAME, adapter), config)
        return
      }
      const configChanges = await getPlan({ before: [currConf], after: [config.clone()] })

      validateConfigChanges(configChanges)

      const currConfWithoutOverrides = await repoCs.get(
        path.join(ADAPTERS_CONFIG_NAME, adapter),
        true
      )
      if (currConfWithoutOverrides === undefined) {
        // Shouldn't get here since we were able the receive the configuration with the overrides.
        throw new Error('failed to set configuration. Could not access to get the current configuration')
      }

      const detailedChanges = wu(configChanges.itemsByEvalOrder())
        .map(item => item.detailedChanges())
        .flatten()
      for (const change of detailedChanges) {
        setPath(currConfWithoutOverrides, change.id, change.data.after)
      }

      await repoCs.set(path.join(ADAPTERS_CONFIG_NAME, adapter), currConfWithoutOverrides)
    },
  }
}
