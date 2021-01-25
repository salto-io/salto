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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import {
  InstanceElement, ElemID, Value, ObjectType, ListType, BuiltinTypes, CORE_ANNOTATIONS,
  createRestriction, MapType,
} from '@salto-io/adapter-api'
import {
  FETCH_ALL_TYPES_AT_ONCE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, NETSUITE,
  SDF_CONCURRENCY_LIMIT, SAVED_SEARCH, DEPLOY_REFERENCED_ELEMENTS, FETCH_TYPE_TIMEOUT_IN_MINUTES,
  CLIENT_CONFIG, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, FETCH_TARGET,
} from './constants'
import { NetsuiteQueryParameters } from './query'

const { makeArray } = collections.array

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_SDF_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_FETCH_TYPE_TIMEOUT_IN_MINUTES = 20
export const DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 50
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false

const clientConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'clientConfig'),
  fields: {
    [FETCH_ALL_TYPES_AT_ONCE]: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_ALL_TYPES_AT_ONCE,
      },
    },
    [FETCH_TYPE_TIMEOUT_IN_MINUTES]: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_TYPE_TIMEOUT_IN_MINUTES,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    [SDF_CONCURRENCY_LIMIT]: {
      type: BuiltinTypes.NUMBER,
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

const queryConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'queryConfig'),
  fields: {
    types: {
      type: new MapType(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {},
      },
    },

    filePaths: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    },
  },
})

const configID = new ElemID(NETSUITE)
export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [TYPES_TO_SKIP]: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [
          SAVED_SEARCH, // Due to https://github.com/oracle/netsuite-suitecloud-sdk/issues/127 we receive changes each fetch.
          // Although the SAVED_SEARCH is not editable since it's encrypted, there still might be
          // a value for specific customers to use it for moving between envs, backup etc.
        ],
      },
    },
    [FILE_PATHS_REGEX_SKIP_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    },
    [DEPLOY_REFERENCED_ELEMENTS]: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
      },
    },
    [CLIENT_CONFIG]: {
      type: clientConfigType,
    },

    [FETCH_TARGET]: {
      type: queryConfigType,
    },
  },
})

export type NetsuiteClientConfig = {
  [FETCH_ALL_TYPES_AT_ONCE]?: boolean
  [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]?: number
  [FETCH_TYPE_TIMEOUT_IN_MINUTES]?: number
  [SDF_CONCURRENCY_LIMIT]?: number
}

export type NetsuiteConfig = {
  [TYPES_TO_SKIP]?: string[]
  [FILE_PATHS_REGEX_SKIP_LIST]?: string[]
  [DEPLOY_REFERENCED_ELEMENTS]?: boolean
  [CLIENT_CONFIG]?: NetsuiteClientConfig
  [FETCH_TARGET]?: NetsuiteQueryParameters
}

export const STOP_MANAGING_ITEMS_MSG = 'Salto failed to fetch some items from NetSuite. '
  + 'In order to complete the fetch operation, '
  + 'Salto needs to stop managing these items by applying the following configuration change:'

// create escaped regex string that will match the new RegExp() input format
const wrapAsRegex = (str: string): string => `^${_.escapeRegExp(str)}$`

const toConfigSuggestions = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: string[]
): Partial<Record<keyof Omit<NetsuiteConfig, 'client'> | keyof NetsuiteClientConfig, Value>> => ({
  ...(failedToFetchAllAtOnce ? { [FETCH_ALL_TYPES_AT_ONCE]: false } : {}),
  ...(!_.isEmpty(failedFilePaths)
    ? { [FILE_PATHS_REGEX_SKIP_LIST]: failedFilePaths.map(wrapAsRegex) }
    : {}),
})


export const getConfigFromConfigChanges = (failedToFetchAllAtOnce: boolean,
  failedFilePaths: string[], currentConfig: NetsuiteConfig): InstanceElement | undefined => {
  const suggestions = toConfigSuggestions(failedToFetchAllAtOnce, failedFilePaths)
  if (_.isEmpty(suggestions)) {
    return undefined
  }

  const clientConfigSuggestion = suggestions[FETCH_ALL_TYPES_AT_ONCE] !== undefined
    ? _.pickBy({
      ...(currentConfig[CLIENT_CONFIG] ?? {}),
      [FETCH_ALL_TYPES_AT_ONCE]: suggestions[FETCH_ALL_TYPES_AT_ONCE],
    }, values.isDefined)
    : currentConfig[CLIENT_CONFIG]

  return new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    _.pickBy({
      ...currentConfig,
      [FILE_PATHS_REGEX_SKIP_LIST]: makeArray(currentConfig[FILE_PATHS_REGEX_SKIP_LIST])
        .concat(makeArray(suggestions[FILE_PATHS_REGEX_SKIP_LIST])),
      [CLIENT_CONFIG]: clientConfigSuggestion,
    }, values.isDefined)
  )
}
