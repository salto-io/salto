/*
*                      Copyright 2023 Salto Labs Ltd.
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
import * as ducktype from './ducktype'
import * as swagger from './swagger'
import * as soap from './soap'
import * as subtypes from './subtypes'
import * as query from './query'
import { computeGetArgs, simpleGetArgs, createUrl, replaceUrlParams } from './request_parameters'
import { RECORDS_PATH, TYPES_PATH, SUBTYPES_PATH, SETTINGS_NESTED_PATH } from './constants'
import { findDataField, returnFullEntry, FindNestedFieldFunc } from './field_finder'
import { filterTypes } from './type_elements'
import { getInstanceName, generateInstanceNameFromConfig, createServiceIds, removeNullValues, toBasicInstance } from './instance_elements'
import { FetchElements, ConfigChangeSuggestion } from './element_getter'

export {
  ducktype,
  swagger,
  soap,
  subtypes,
  computeGetArgs, simpleGetArgs,
  findDataField, returnFullEntry, FindNestedFieldFunc,
  RECORDS_PATH, TYPES_PATH, SUBTYPES_PATH, SETTINGS_NESTED_PATH,
  filterTypes,
  getInstanceName,
  generateInstanceNameFromConfig,
  createServiceIds,
  createUrl,
  replaceUrlParams,
  removeNullValues,
  query,
  FetchElements, ConfigChangeSuggestion,
  toBasicInstance,
}
