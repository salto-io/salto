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
export { FoundSearchResult, SearchResult, createElementsMap, findElement } from './src/core/search'
export { mergeElements, MergeError,
  DuplicateAnnotationError, MergeResult } from './src/core/merger'
export * from './src/workspace/hidden_values'
export {
  Workspace, WorkspaceError, SourceFragment, StateRecency, loadWorkspace, EnvironmentsSources,
  initWorkspace,
} from './src/workspace/workspace'
export { ConfigSource, configSource } from './src/workspace/config_source'
export { Errors } from './src/workspace/errors'
export { NaclFile, FILE_EXTENSION, NaclFilesSource,
  naclFilesSource } from './src/workspace/nacl_files/nacl_files_source'
export { parse, SourceRange, parseElemID } from './src/parser/parse'
export { serialize, deserialize } from './src/serializer/elements'
export { SourceMap } from './src/parser/source_map'
export { dumpElements, dumpElemID } from './src/parser/dump'
export { WORKSPACE_CONFIG_NAME, USER_CONFIG_NAME, workspaceConfigType,
  workspaceUserConfigType } from './src/workspace/workspace_config_types'
export { State } from './src/workspace/state'
export { File, SyncDirectoryStore, DirectoryStore } from './src/workspace/dir_store'
export { resolve } from './src/core/expressions'
export { parseResultCache } from './src/workspace/cache'
export { StaticFilesCache, StaticFilesCacheResult } from './src/workspace/static_files/cache'
export { buildStaticFilesSource } from './src/workspace/static_files/source'
export { STATIC_RESOURCES_FOLDER, StaticFilesSource } from './src/workspace/static_files/common'
