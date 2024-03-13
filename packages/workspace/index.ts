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
import * as errors from './src/errors'
import * as nacl from './src/workspace/nacl_files'
import {
  Workspace,
  SourceLocation,
  StateRecency,
  loadWorkspace,
  isValidEnvName,
  EnvironmentsSources,
  EnvironmentSource,
  initWorkspace,
  WorkspaceComponents,
  UnresolvedElemIDs,
  FromSourceWithEnv,
  COMMON_ENV_PREFIX,
  UpdateNaclFilesResult,
  listElementsDependenciesInWorkspace,
} from './src/workspace/workspace'
import * as hiddenValues from './src/workspace/hidden_values'
import * as configSource from './src/workspace/config_source'
import * as workspaceConfigSource from './src/workspace/workspace_config_source'
import * as adaptersConfigSource from './src/workspace/adapters_config_source'
import {
  WorkspaceConfig,
  EnvConfig,
  StateConfig,
  ProviderOptionsS3,
  ProviderOptionsFile,
} from './src/workspace/config/workspace_config_types'
import * as state from './src/workspace/state'
import * as dirStore from './src/workspace/dir_store'
import * as parseCache from './src/workspace/nacl_files/parsed_nacl_files_cache'
import * as staticFiles from './src/workspace/static_files'
import * as merger from './src/merger'
import * as expressions from './src/expressions'
import * as serialization from './src/serializer/elements'
import * as pathIndex from './src/workspace/path_index'
import { Author } from './src/workspace/changed_by_index'
import {
  createElementSelector,
  ElementSelector,
  validateSelectorsMatches,
  createTopLevelSelector,
  selectElementsBySelectorsWithoutReferences,
  selectElementsBySelectors,
  selectElementIdsByTraversal,
  createElementSelectors,
  ElementIDToValue,
  isTopLevelSelector,
} from './src/workspace/element_selector'
import * as validator from './src/validator'
import * as elementSource from './src/workspace/elements_source'
import * as remoteMap from './src/workspace/remote_map'
import { buildStaticFilesCache } from './src/workspace/static_files/static_files_cache'
import { updateElementsWithAlternativeAccount, createAdapterReplacedID } from './src/element_adapter_rename'
import { RemoteElementSource, ElementsSource } from './src/workspace/elements_source'
import { FromSource } from './src/workspace/nacl_files/multi_env/multi_env_source'
import { State } from './src/workspace/state'
import { PathIndex, splitElementByPath, getElementsPathHints, filterByPathHint } from './src/workspace/path_index'
import { createPathIndexForElement } from './src/path_index_fallbacks'

export {
  errors,
  hiddenValues,
  serialization,
  merger,
  dirStore,
  parseCache,
  configSource,
  staticFiles,
  expressions,
  nacl,
  pathIndex,
  elementSource,
  remoteMap,
  WorkspaceConfig,
  ProviderOptionsS3,
  ProviderOptionsFile,
  EnvConfig,
  StateConfig,
  // Workspace exports
  Workspace,
  SourceLocation,
  StateRecency,
  loadWorkspace,
  EnvironmentSource,
  EnvironmentsSources,
  initWorkspace,
  COMMON_ENV_PREFIX,
  state,
  workspaceConfigSource,
  adaptersConfigSource,
  WorkspaceComponents,
  validator,
  createElementSelector,
  ElementSelector,
  validateSelectorsMatches,
  selectElementsBySelectorsWithoutReferences,
  selectElementsBySelectors,
  createElementSelectors,
  createTopLevelSelector,
  isTopLevelSelector,
  selectElementIdsByTraversal,
  ElementIDToValue,
  RemoteElementSource,
  UnresolvedElemIDs,
  isValidEnvName,
  FromSource,
  FromSourceWithEnv,
  UpdateNaclFilesResult,
  ElementsSource,
  State,
  splitElementByPath,
  PathIndex,
  filterByPathHint,
  getElementsPathHints,
  updateElementsWithAlternativeAccount,
  createAdapterReplacedID,
  Author,
  createPathIndexForElement,
  buildStaticFilesCache,
  listElementsDependenciesInWorkspace,
}
