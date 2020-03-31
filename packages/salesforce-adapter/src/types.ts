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
import { ElemID, ObjectType, BuiltinTypes, Field, CORE_ANNOTATIONS,
  RESTRICTION_ANNOTATIONS, ListType } from '@salto-io/adapter-api'
import * as constants from './constants'

export const METADATA_TYPES_SKIPPED_LIST = 'metadataTypesSkippedList'
export const INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList'
export const MAX_CONCURRENT_RETRIEVE_REQUESTS = 'maxConcurrentRetrieveRequests'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'

export type SalesforceConfig = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: string[]
  [MAX_CONCURRENT_RETRIEVE_REQUESTS]?: number
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]?: number
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
    username: new Field(configID, 'username', BuiltinTypes.STRING),
    password: new Field(configID, 'password', BuiltinTypes.STRING),
    token: new Field(configID, 'token', BuiltinTypes.STRING,
      { message: 'Token (empty if your org uses IP whitelisting)' }),
    sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
  },
})

export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [METADATA_TYPES_SKIPPED_LIST]: new Field(
      configID,
      METADATA_TYPES_SKIPPED_LIST,
      new ListType(BuiltinTypes.STRING),
      {
        [CORE_ANNOTATIONS.DEFAULT]: [
          'Report', 'ReportType', 'ReportFolder', 'Dashboard', 'DashboardFolder',
        ],
      },
    ),
    [INSTANCES_REGEX_SKIPPED_LIST]: new Field(
      configID,
      INSTANCES_REGEX_SKIPPED_LIST,
      new ListType(BuiltinTypes.STRING),
      {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    ),
    [MAX_CONCURRENT_RETRIEVE_REQUESTS]: new Field(
      configID,
      MAX_CONCURRENT_RETRIEVE_REQUESTS,
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_CONCURRENT_RETRIEVE_REQUESTS,
        [CORE_ANNOTATIONS.RESTRICTION]: {
          [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
          [RESTRICTION_ANNOTATIONS.MIN]: 1,
          [RESTRICTION_ANNOTATIONS.MAX]: 25,
        },
      },
    ),
    [MAX_ITEMS_IN_RETRIEVE_REQUEST]: new Field(
      configID,
      MAX_ITEMS_IN_RETRIEVE_REQUEST,
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: {
          [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
          [RESTRICTION_ANNOTATIONS.MIN]: 1000,
          [RESTRICTION_ANNOTATIONS.MAX]: 10000,
        },
      },
    ),
  },
})
