/*
*                      Copyright 2022 Salto Labs Ltd.
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
export { State, StateData, StateMetadataKey, buildStateData, createStateNamespace } from './state'
export { buildHistoryStateStaticFilesSource, getFileName as getHistoryStateStaticFilesSourceFileName } from './static_files_sources/history_static_files_source'
export { buildOverrideStateStaticFilesSource } from './static_files_sources/override_static_files_source'
export { buildInMemState } from './in_mem'
