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
import { collections } from '@salto-io/lowerdash'
import {
  InstanceElement, ElemID, Value, ObjectType, ListType, BuiltinTypes, CORE_ANNOTATIONS,
  createRestriction,
} from '@salto-io/adapter-api'
import {
  FETCH_ALL_TYPES_AT_ONCE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, NETSUITE,
  SDF_CONCURRENCY_LIMIT,
} from './constants'

const { makeArray } = collections.array

const configID = new ElemID(NETSUITE)
export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [TYPES_TO_SKIP]: {
      type: new ListType(BuiltinTypes.STRING),
    },
    [FILE_PATHS_REGEX_SKIP_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
    },
    [FETCH_ALL_TYPES_AT_ONCE]: {
      type: BuiltinTypes.BOOLEAN,
    },
    [SDF_CONCURRENCY_LIMIT]: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
  },
})

export type NetsuiteConfig = {
  [TYPES_TO_SKIP]?: string[]
  [FILE_PATHS_REGEX_SKIP_LIST]?: string[]
  [FETCH_ALL_TYPES_AT_ONCE]?: boolean
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
    {
      [TYPES_TO_SKIP]: makeArray(currentConfig[TYPES_TO_SKIP])
        .concat(makeArray(suggestions[TYPES_TO_SKIP])),
      [FILE_PATHS_REGEX_SKIP_LIST]: makeArray(currentConfig[FILE_PATHS_REGEX_SKIP_LIST])
        .concat(makeArray(suggestions[FILE_PATHS_REGEX_SKIP_LIST])),
      [FETCH_ALL_TYPES_AT_ONCE]: suggestions[FETCH_ALL_TYPES_AT_ONCE]
        ?? currentConfig[FETCH_ALL_TYPES_AT_ONCE],
      [SDF_CONCURRENCY_LIMIT]: currentConfig[SDF_CONCURRENCY_LIMIT],
    }
  )
}
