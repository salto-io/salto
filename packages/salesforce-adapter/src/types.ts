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
export const DATA_MANAGEMENT = 'dataManagement'
export const INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList'
export const MAX_CONCURRENT_RETRIEVE_REQUESTS = 'maxConcurrentRetrieveRequests'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'
export const ENABLE_HIDE_TYPES_IN_NACLS = 'enableHideTypesInNacls'
export const SYSTEM_FIELDS = 'systemFields'

export type FilterContext = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: RegExp[]
  [UNSUPPORTED_SYSTEM_FIELDS]?: string[]
  [DATA_MANAGEMENT]?: DataManagementConfig[]
  [SYSTEM_FIELDS]?: string[]
  [ENABLE_HIDE_TYPES_IN_NACLS]?: boolean
}

export type DataManagementConfig = {
  name: string
  enabled: boolean
  isNameBasedID: boolean
  includeNamespaces?: string[]
  includeObjects?: string[]
  excludeObjects?: string[]
}

export type SalesforceConfig = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: string[]
  [MAX_CONCURRENT_RETRIEVE_REQUESTS]?: number
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]?: number
  [ENABLE_HIDE_TYPES_IN_NACLS]?: boolean
  [DATA_MANAGEMENT]?: DataManagementConfig[]
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

const dataManagementType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, DATA_MANAGEMENT),
  fields: {
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enabled: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    includeNamespaces: { type: new ListType(BuiltinTypes.STRING) },
    includeObjects: { type: new ListType(BuiltinTypes.STRING) },
    excludeObjects: { type: new ListType(BuiltinTypes.STRING) },
  },
})

export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [METADATA_TYPES_SKIPPED_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [
          'Report', 'ReportType', 'ReportFolder', 'Dashboard', 'DashboardFolder', 'Profile',
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
    [ENABLE_HIDE_TYPES_IN_NACLS]: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_ENABLE_HIDE_TYPES_IN_NACLS,
      },
    },
    [DATA_MANAGEMENT]: {
      type: new ListType(dataManagementType),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [
          {
            name: 'CPQ',
            enabled: false,
            isNameBasedID: true,
            includeNamespaces: ['SBQQ'],
            includeObjects: [
              'Product2',
              'Pricebook2',
              'PricebookEntry',
            ],
            excludeObjects: [
              'SBQQ__ContractedPrice__c',
              'SBQQ__Quote__c',
              'SBQQ__QuoteLine__c',
              'SBQQ__Subscription__c',
              'SBQQ__SubscribedAsset__c',
              'SBQQ__SubscribedQuoteLine__c',
              'SBQQ__SubscriptionConsumptionRate__c',
              'SBQQ__SubscriptionConsumptionSchedule__c',
              'SBQQ__WebQuote__c',
              'SBQQ__WebQuoteLine__c',
            ],
          },
        ],
      },
    },
  },
})

export interface MetadataInfoWithStaticFile extends MetadataInfo {
 content: StaticFile
}
