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
import * as ErrorTypes from './src/errors'

export { ErrorTypes }
export { Plan, PlanItem, DetailedChange } from './src/core/plan'
export { FetchChange, FetchProgressEvents, StepEmitter } from './src/core/fetch'
export * from './src/api'
export { FoundSearchResult, SearchResult } from './src/core/search'
export { ItemStatus } from './src/core/deploy'
export { getAdaptersCredentialsTypes } from './src/core/adapters/adapters'
export {
  Workspace, WorkspaceError, SourceFragment, StateRecency, loadWorkspace, EnvironmentsSources,
} from './src/workspace/workspace'
export {
  loadLocalWorkspace, initLocalWorkspace, loadLocalElementsSources,
} from './src/workspace/local/workspace'
export {
  workspaceConfigSource as localWorkspaceConfigSource,
  WorkspaceConfigSource as LocalWorkspaceConfigSource,
} from './src/workspace/local/workspace_config'
export { ConfigSource } from './src/workspace/config_source'
export { Errors } from './src/workspace/errors'
export { NaclFile, FILE_EXTENSION } from './src/workspace/nacl_files/nacl_files_source'
export { parse, SourceRange, parseElemID } from './src/parser/parse'
export { SourceMap } from './src/parser/internal/source_map'
export { dumpElements, dumpElemID } from './src/parser/dump'
export { SALTO_HOME_VAR, AppConfig, configFromDisk, CommandConfig } from './src/app_config'
export {
  telemetrySender, Telemetry, TelemetryEvent,
  CountEvent, StackEvent, Tags, isCountEvent,
  isStackEvent,
} from './src/telemetry'
