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
export { Plan, PlanItem } from './src/core/plan'
export { FetchChange, FetchProgressEvents, StepEmitter } from './src/core/fetch'
export * from './src/api'
export { ItemStatus } from './src/core/deploy'
export { getAdaptersCredentialsTypes, getDefaultAdapterConfig } from './src/core/adapters/adapters'
export {
  loadLocalWorkspace, initLocalWorkspace, loadLocalElementsSources, getNaclFilesSourceParams,
  CACHE_DIR_NAME, envFolderExists, COMMON_ENV_PREFIX,
} from './src/local-workspace/workspace'
export {
  workspaceConfigSource as localWorkspaceConfigSource,
  WorkspaceConfigSource as LocalWorkspaceConfigSource,
} from './src/local-workspace/workspace_config'
export { SALTO_HOME_VAR, AppConfig, configFromDisk, CommandConfig, getConfigDir } from './src/app_config'
export {
  telemetrySender, Telemetry, TelemetryEvent,
  CountEvent, StackEvent, Tags, isCountEvent,
  isStackEvent, EVENT_TYPES,
} from './src/telemetry'
export { localDirectoryStore } from './src/local-workspace/dir_store'
export { WORKSPACE_CONFIG_NAME, USER_CONFIG_NAME, ADAPTERS_CONFIG_NAME, ENVS_CONFIG_NAME, workspaceConfigTypes, EnvsConfig } from './src/local-workspace/workspace_config_types'
export { createRemoteMap } from './src/core/db/remote_map'
