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

const CONFIG_NAMESPACE = 'salto'
export const WORKSPACE_CONFIG_NAME = 'config'
export const PREFERENCE_CONFIG_NAME = 'preference'

const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }
const envConfigElemID = new ElemID(CONFIG_NAMESPACE, 'env')
export const envConfigType = new ObjectType({
  elemID: envConfigElemID,
  fields: {
    name: new Field(envConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    services: new Field(envConfigElemID, 'services', new ListType(BuiltinTypes.STRING)),
  },
})

const workspaceConfigElemID = new ElemID(CONFIG_NAMESPACE)
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

export const preferencesWorkspaceConfigType = new ObjectType({
  elemID: workspaceConfigElemID,
  fields: {
    currentEnv: new Field(workspaceConfigElemID, 'currentEnv', BuiltinTypes.STRING, requireAnno),
  },
  isSettings: true,
})

export const workspaceConfigTypes = [workspaceConfigType, envConfigType,
  preferencesWorkspaceConfigType]

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

export type PreferenceConfig = {
  currentEnv: string
}

export const preferencesConfigInstance = (pref: PreferenceConfig): InstanceElement =>
  new InstanceElement(PREFERENCE_CONFIG_NAME, preferencesWorkspaceConfigType, pref)

export const workspaceConfigInstance = (wsConfig: WorkspaceConfig): InstanceElement =>
  new InstanceElement(WORKSPACE_CONFIG_NAME, workspaceConfigType, wsConfig)
