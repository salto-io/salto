
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
import { collections } from '@salto-io/lowerdash'
import { getAdaptersCredentialsTypes } from '../../core/adapters'
import { configSource, ConfigSource } from '../config_source'
import { localDirectoryStore } from './dir_store'
import { getSaltoHome } from '../../app_config'
import { WORKSPACE_CONFIG_NAME, preferencesWorkspaceConfigType } from '../workspace_config_types'

const { makeArray } = collections.array

export const CONFIG_DIR_NAME = 'salto.config'

export const getConfigDir = (baseDir: string): string => (
  path.join(path.resolve(baseDir), CONFIG_DIR_NAME)
)

export type WorkspaceConfigSource = ConfigSource & {
  envs: ReadonlyArray<string>
  localStorage: string
}
export const workspaceConfigSource = async (baseDir: string, localStorage?: string):
Promise<WorkspaceConfigSource> => {
  const repoConfigSource = configSource(localDirectoryStore(getConfigDir(baseDir)))
  const conf = await repoConfigSource.get(WORKSPACE_CONFIG_NAME)
  if (_.isUndefined(conf) && _.isUndefined(localStorage)) {
    throw new Error('Cannot locate local storage directory')
  }
  const computedLocalStorage = localStorage
    || path.join(getSaltoHome(), `${conf?.value.name}-${conf?.value.uid}`)
  const localConfigSource = configSource(localDirectoryStore(computedLocalStorage))
  const locals = Object.values(getAdaptersCredentialsTypes())
    .concat(preferencesWorkspaceConfigType)
  return {
    localStorage: computedLocalStorage,
    envs: makeArray(conf?.value.envs).map((env: {name: string}) => env.name),
    get: async (configName: string): Promise<InstanceElement | undefined> =>
      await repoConfigSource.get(configName) || localConfigSource.get(configName),
    set: (configName: string, config: Readonly<InstanceElement>): Promise<void> => {
      if (locals.includes(config.type)) {
        return localConfigSource.set(configName, config)
      }
      return repoConfigSource.set(configName, config)
    },
  }
}
