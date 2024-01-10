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
import { CUSTOM_RECORD_TYPE_NAME_PREFIX, SAVED_SEARCH } from '../constants'

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_COMMAND_TIMEOUT_IN_MINUTES = 10
export const DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 40
export const DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB = 3
export const WARNING_MAX_FILE_CABINET_SIZE_IN_GB = 1
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false
export const DEFAULT_WARN_STALE_DATA = false
export const DEFAULT_VALIDATE = true
export const DEFAULT_MAX_INSTANCES_VALUE = 5000
export const DEFAULT_MAX_INSTANCES_PER_TYPE = [
  { name: `${CUSTOM_RECORD_TYPE_NAME_PREFIX}.*`, limit: 10_000 },
  { name: SAVED_SEARCH, limit: 20_000 },
]
export const UNLIMITED_INSTANCES_VALUE = -1
export const DEFAULT_AXIOS_TIMEOUT_IN_MINUTES = 20

export const ALL_TYPES_REGEX = '.*'

export const FILE_TYPES_TO_EXCLUDE_REGEX = '.*\\.(csv|pdf|eml|png|gif|jpeg|xls|xlsx|doc|docx|ppt|pptx)'

// Taken from https://github.com/salto-io/netsuite-suitecloud-sdk/blob/e009e0eefcd918635353d093be6a6c2222d223b8/packages/node-cli/src/validation/InteractiveAnswersValidator.js#L27
export const SUITEAPP_ID_FORMAT_REGEX = /^[a-z0-9]+(\.[a-z0-9]+){2}$/

export const REQUIRED_FEATURE_SUFFIX = ':required'

export const ERROR_MESSAGE_PREFIX = 'Received invalid adapter config input.'
