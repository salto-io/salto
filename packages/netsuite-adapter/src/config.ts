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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { InstanceElement, ElemID, Value, ObjectType, ListType, BuiltinTypes, CORE_ANNOTATIONS, createRestriction } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import {
  FETCH_ALL_TYPES_AT_ONCE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, NETSUITE,
  SDF_CONCURRENCY_LIMIT, SAVED_SEARCH, DEPLOY_REFERENCED_ELEMENTS, FETCH_TYPE_TIMEOUT_IN_MINUTES,
} from './constants'

const { makeArray } = collections.array

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_SDF_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_FETCH_TYPE_TIMEOUT_IN_MINUTES = 12
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false

const configID = new ElemID(NETSUITE)
export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [TYPES_TO_SKIP]: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [
          SAVED_SEARCH, // Due to https://github.com/oracle/netsuite-suitecloud-sdk/issues/127 we receive changes each fetch.
          // Although the SAVED_SEARCH is not editable since it's encrypted, there still might be
          // a value for specific customers to use it for moving between envs, backup etc.
        ],
      },
    },
    [FILE_PATHS_REGEX_SKIP_LIST]: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    },
    [FETCH_ALL_TYPES_AT_ONCE]: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_ALL_TYPES_AT_ONCE,
      },
    },
    [FETCH_TYPE_TIMEOUT_IN_MINUTES]: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_TYPE_TIMEOUT_IN_MINUTES,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    [DEPLOY_REFERENCED_ELEMENTS]: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
      },
    },
    [SDF_CONCURRENCY_LIMIT]: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_SDF_CONCURRENCY,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
  },
})

export type NetsuiteConfig = {
  [TYPES_TO_SKIP]?: string[]
  [FILE_PATHS_REGEX_SKIP_LIST]?: string[]
  [FETCH_ALL_TYPES_AT_ONCE]?: boolean
  [FETCH_TYPE_TIMEOUT_IN_MINUTES]?: number
  [DEPLOY_REFERENCED_ELEMENTS]?: boolean
  [SDF_CONCURRENCY_LIMIT]?: number
}

export const STOP_MANAGING_ITEMS_MSG = 'Salto failed to fetch some items from NetSuite. '
  + 'In order to complete the fetch operation, '
  + 'Salto needs to stop managing these items by applying the following configuration change:'

// create escaped regex string that will match the new RegExp() input format
const wrapAsRegex = (str: string): string => `^${_.escapeRegExp(str)}$`

const toConfigSuggestions = (failedToFetchAllAtOnce: boolean, failedTypes: string[],
  failedFilePaths: string[]): Partial<Record<keyof NetsuiteConfig, Value>> => ({
  ...(failedToFetchAllAtOnce ? { [FETCH_ALL_TYPES_AT_ONCE]: false } : {}),
  ...(!_.isEmpty(failedTypes) ? { [TYPES_TO_SKIP]: failedTypes } : {}),
  ...(!_.isEmpty(failedFilePaths)
    ? { [FILE_PATHS_REGEX_SKIP_LIST]: failedFilePaths.map(wrapAsRegex) }
    : {}),
})


export const getConfigFromConfigChanges = (failedToFetchAllAtOnce: boolean, failedTypes: string[],
  failedFilePaths: string[], currentConfig: NetsuiteConfig): InstanceElement | undefined => {
  const suggestions = toConfigSuggestions(failedToFetchAllAtOnce, failedTypes, failedFilePaths)
  if (_.isEmpty(suggestions)) {
    return undefined
  }
  return new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    _.pickBy({
      [TYPES_TO_SKIP]: makeArray(currentConfig[TYPES_TO_SKIP])
        .concat(makeArray(suggestions[TYPES_TO_SKIP])),
      [FILE_PATHS_REGEX_SKIP_LIST]: makeArray(currentConfig[FILE_PATHS_REGEX_SKIP_LIST])
        .concat(makeArray(suggestions[FILE_PATHS_REGEX_SKIP_LIST])),
      [FETCH_ALL_TYPES_AT_ONCE]: suggestions[FETCH_ALL_TYPES_AT_ONCE]
        ?? currentConfig[FETCH_ALL_TYPES_AT_ONCE],
      [DEPLOY_REFERENCED_ELEMENTS]: currentConfig[DEPLOY_REFERENCED_ELEMENTS],
      [SDF_CONCURRENCY_LIMIT]: currentConfig[SDF_CONCURRENCY_LIMIT],
      [FETCH_TYPE_TIMEOUT_IN_MINUTES]: currentConfig[FETCH_TYPE_TIMEOUT_IN_MINUTES],
    }, values.isDefined)
  )
}
