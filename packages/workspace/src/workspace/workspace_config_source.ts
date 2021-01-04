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
import { InstanceElement } from '@salto-io/adapter-api'
import { WorkspaceConfig } from './config/workspace_config_types'

// Seperating adapter config to allow for lazy adapter loading.
export type AdapterConfigSource = {
  getAdapter(adapter: string): Promise<InstanceElement | undefined>
  setAdapter(adapter: string, config: Readonly<InstanceElement>): Promise<void>
}

export type WorkspaceConfigSource = {
  getWorkspaceConfig(): Promise<WorkspaceConfig>
  setWorkspaceConfig(config: WorkspaceConfig): Promise<void>
} & AdapterConfigSource
