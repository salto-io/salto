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
import {
  ElemID, CORE_ANNOTATIONS, ObjectType, Field, BuiltinTypes, ListType, InstanceElement,
} from '@salto-io/adapter-api'

export const WORKSPACE_CONFIG_NAME = 'workspace'
export const USER_CONFIG_NAME = 'workspaceUser'

const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }
const envConfigElemID = new ElemID(WORKSPACE_CONFIG_NAME, 'env')
export const envConfigType = new ObjectType({
  elemID: envConfigElemID,
  fields: {
    name: new Field(envConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    services: new Field(envConfigElemID, 'services', new ListType(BuiltinTypes.STRING)),
  },
})

const workspaceConfigElemID = new ElemID(WORKSPACE_CONFIG_NAME)
export const workspaceConfigType = new ObjectType({
  elemID: workspaceConfigElemID,
  fields: {
    uid: new Field(workspaceConfigElemID, 'uid', BuiltinTypes.STRING, requireAnno),
    name: new Field(workspaceConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    // Once we have map type we can have here map env name -> env config
    envs: new Field(workspaceConfigElemID, 'envs', new ListType(envConfigType)),
    staleStateThresholdMinutes: new Field(workspaceConfigElemID, 'staleStateThresholdMinutes', BuiltinTypes.NUMBER),
  },
  isSettings: true,
})

const userConfigElemID = new ElemID(USER_CONFIG_NAME)
export const workspaceUserConfigType = new ObjectType({
  elemID: userConfigElemID,
  fields: {
    currentEnv: new Field(userConfigElemID, 'currentEnv', BuiltinTypes.STRING, requireAnno),
  },
  isSettings: true,
})

export const workspaceConfigTypes = [workspaceConfigType, envConfigType,
  workspaceUserConfigType]

export type EnvConfig = {
    name: string
    services?: string[]
  }

export type WorkspaceConfig = {
    uid: string
    name: string
    envs: EnvConfig[]
    staleStateThresholdMinutes?: number
  }

export type WorkspaceUserConfig = {
  currentEnv: string
}

export const workspaceUserConfigInstance = (pref: WorkspaceUserConfig): InstanceElement =>
  new InstanceElement(USER_CONFIG_NAME, workspaceUserConfigType, pref)

export const workspaceConfigInstance = (wsConfig: WorkspaceConfig): InstanceElement =>
  new InstanceElement(WORKSPACE_CONFIG_NAME, workspaceConfigType, wsConfig)
