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
export { toInstance } from './instance_elements'
export { replaceInstanceTypeForDeploy, restoreInstanceTypeFromDeploy } from './deployment_placeholder_types'
export { extractStandaloneFields } from './standalone_field_extractor'
export { getAllElements, getTypeAndInstances, ConfigChangeSuggestion, FetchElements, EntriesRequester, getEntriesResponseValues, getNewElementsFromInstances, getUniqueConfigSuggestions } from './transformer'
export { generateType, toNestedTypeName } from './type_elements'
export { addRemainingTypes } from './add_remaining_types'
