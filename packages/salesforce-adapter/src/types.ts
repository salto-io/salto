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
import {
  ElemID, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, ListType, createRestriction,
  StaticFile,
} from '@salto-io/adapter-api'
import { MetadataInfo } from 'jsforce'
import * as constants from './constants'

export const METADATA_TYPES_SKIPPED_LIST = 'metadataTypesSkippedList'
export const UNSUPPORTED_SYSTEM_FIELDS = 'unsupportedSystemFields'
export const INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList'
export const MAX_CONCURRENT_RETRIEVE_REQUESTS = 'maxConcurrentRetrieveRequests'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'
export const HIDE_TYPES_IN_NACLS = 'hideTypesInNacls'

export type FilterContext = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: RegExp[]
  [UNSUPPORTED_SYSTEM_FIELDS]?: string[]
}

export type SalesforceConfig = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: string[]
  [MAX_CONCURRENT_RETRIEVE_REQUESTS]?: number
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]?: number
  [HIDE_TYPES_IN_NACLS]?: boolean
}

export type ConfigChangeSuggestion = {
  type: keyof SalesforceConfig & ('metadataTypesSkippedList' | 'instancesRegexSkippedList')
  value: string
}
export type FetchElements<T> = {
  configChanges: ConfigChangeSuggestion[]
  elements: T
}

const configID = new ElemID('salesforce')

export const credentialsType = new ObjectType({
  elemID: configID,
  fields: {
    username: { type: BuiltinTypes.STRING },
    password: { type: BuiltinTypes.STRING },
    token: {
      type: BuiltinTypes.STRING,
      annotations: { message: 'Token (empty if your org uses IP whitelisting)' },
    },
    sandbox: { type: BuiltinTypes.BOOLEAN },
  },
})

export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [METADATA_TYPES_SKIPPED_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [
          'Report', 'ReportType', 'ReportFolder', 'Dashboard', 'DashboardFolder',
        ],
      },
    },
    [INSTANCES_REGEX_SKIPPED_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [
          '^EmailTemplate.MarketoEmailTemplates',
        ],
      },
    },
    [MAX_CONCURRENT_RETRIEVE_REQUESTS]: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_CONCURRENT_RETRIEVE_REQUESTS,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1, max: 25 }),
      },
    },
    [MAX_ITEMS_IN_RETRIEVE_REQUEST]: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1000, max: 10000 }),
      },
    },
    [HIDE_TYPES_IN_NACLS]: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_HIDE_TYPES_IN_NACLS,
      },
    },
  },
})

export interface MetadataInfoWithStaticFile extends MetadataInfo {
 content: StaticFile
}
