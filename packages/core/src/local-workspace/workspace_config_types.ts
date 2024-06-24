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
import { EnvConfig, WorkspaceConfig } from '@salto-io/workspace'
import {
  InstanceElement,
  ElemID,
  ObjectType,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ListType,
  MapType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'

export type WorkspaceMetadataConfig = Pick<WorkspaceConfig, 'uid' | 'name' | 'staleStateThresholdMinutes' | 'state'>
export type EnvsConfig = Pick<WorkspaceConfig, 'envs'>
export type UserDataConfig = Pick<WorkspaceConfig, 'currentEnv'>

export const WORKSPACE_CONFIG_NAME = 'workspace'
export const ENVS_CONFIG_NAME = 'envs'
export const USER_CONFIG_NAME = 'workspaceUser'
export const ADAPTERS_CONFIG_NAME = 'adapters'

const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }

const userDataConfigElemID = new ElemID(USER_CONFIG_NAME)
const userDataConfigType = new ObjectType({
  elemID: userDataConfigElemID,
  fields: {
    currentEnv: { refType: BuiltinTypes.STRING, annotations: requireAnno },
  },
  isSettings: true,
})
const envConfigElemID = new ElemID(ENVS_CONFIG_NAME, 'env')
const envConfigType = createMatchingObjectType<Omit<EnvConfig, 'services'>>({
  elemID: envConfigElemID,
  fields: {
    name: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
    accountToServiceName: { refType: new MapType(BuiltinTypes.STRING) },
  },
})

const envsConfigElemID = new ElemID(ENVS_CONFIG_NAME)
const envsConfigType = new ObjectType({
  elemID: envsConfigElemID,
  fields: {
    // Once we have map type we can have here map env name -> env config
    envs: { refType: new ListType(envConfigType) },
  },
  isSettings: true,
})

const workspaceMetatadataConfigElemID = new ElemID(WORKSPACE_CONFIG_NAME)
const workspaceMetadataConfigType = new ObjectType({
  elemID: workspaceMetatadataConfigElemID,
  fields: {
    uid: { refType: BuiltinTypes.STRING, annotations: requireAnno },
    name: { refType: BuiltinTypes.STRING, annotations: requireAnno },
    staleStateThresholdMinutes: { refType: BuiltinTypes.NUMBER },
  },
  isSettings: true,
})

export const workspaceConfigTypes = [envsConfigType, userDataConfigType, envConfigType, workspaceMetadataConfigType]

export const userDataConfigInstance = (pref: UserDataConfig): InstanceElement =>
  new InstanceElement(USER_CONFIG_NAME, userDataConfigType, pref)

export const envsConfigInstance = (envs: EnvsConfig): InstanceElement =>
  new InstanceElement(ENVS_CONFIG_NAME, envsConfigType, envs)

export const workspaceMetadataConfigInstance = (wsConfig: WorkspaceMetadataConfig): InstanceElement =>
  new InstanceElement(WORKSPACE_CONFIG_NAME, workspaceMetadataConfigType, _.omitBy(wsConfig, _.isUndefined))
