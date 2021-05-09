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
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import {
  ElemID, ObjectType, InstanceElement, BuiltinTypes, CORE_ANNOTATIONS, ListType, createRestriction,
  FieldDefinition,
} from '@salto-io/adapter-api'
import * as constants from './constants'
import { SALESFORCE } from './constants'

export const CLIENT_CONFIG = 'client'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'
export const USE_OLD_PROFILES = 'useOldProfiles'
export const FETCH_CONFIG = 'fetch'
export const METADATA_CONFIG = 'metadata'
const METADATA_INCLUDE_LIST = 'include'
const METADATA_EXCLUDE_LIST = 'exclude'
const METADATA_TYPE = 'metadataType'
const METADATA_NAME = 'name'
const METADATA_NAMESPACE = 'namespace'
export const DATA_CONFIGURATION = 'data'
export const METADATA_TYPES_SKIPPED_LIST = 'metadataTypesSkippedList'
export const DATA_MANAGEMENT = 'dataManagement'
export const INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList'
export const SHOULD_FETCH_ALL_CUSTOM_SETTINGS = 'fetchAllCustomSettings'


export type MetadataInstance = {
  metadataType: string
  namespace: string
  name: string
}

export type MetadataQueryParams = Partial<MetadataInstance>

export type MetadataParams = {
  include?: MetadataQueryParams[]
  exclude?: MetadataQueryParams[]
}

export type OptionalFeatures = {
  extraDependencies?: boolean
}

export type FetchParameters = {
  metadata?: MetadataParams
  data?: DataManagementConfig
  fetchAllCustomSettings?: boolean // TODO - move this into optional features
  optionalFeatures?: OptionalFeatures
  target?: string[]
}

export type DeprecatedMetadataParams = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: string[]
}

export type DeprecatedFetchParameters = {
  [DATA_MANAGEMENT]?: DataManagementConfig
} & DeprecatedMetadataParams

type ObjectIdSettings = {
  objectsRegex: string
  idFields: string[]
}

export type SaltoIDSettings = {
  defaultIdFields: string[]
  overrides?: ObjectIdSettings[]
}

export type DataManagementConfig = {
  includeObjects: string[]
  excludeObjects?: string[]
  allowReferenceTo?: string[]
  saltoIDSettings: SaltoIDSettings
}

export type ClientRateLimitConfig = Partial<{
  total: number
  retrieve: number
  read: number
  list: number
  query: number
}>

export type ClientPollingConfig = Partial<{
  interval: number
  timeout: number
}>

type ClientDeployConfig = Partial<{
  rollbackOnError: boolean
  ignoreWarnings: boolean
  purgeOnDelete: boolean
  checkOnly: boolean
  testLevel: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg'
  runTests: string[]
  deleteBeforeUpdate: boolean
}>

export enum RetryStrategyName {
  'HttpError',
  'HTTPOrNetworkError',
  'NetworkError',
}
type RetryStrategy = keyof typeof RetryStrategyName
export type ClientRetryConfig = Partial<{
  maxAttempts: number
  retryDelay: number
  retryStrategy: RetryStrategy
}>

export type SalesforceClientConfig = Partial<{
  polling: ClientPollingConfig
  deploy: ClientDeployConfig
  maxConcurrentApiRequests: ClientRateLimitConfig
  retry: ClientRetryConfig
}>

export type SalesforceConfig = {
  [FETCH_CONFIG]?: FetchParameters
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]?: number
  [USE_OLD_PROFILES]?: boolean
  [CLIENT_CONFIG]?: SalesforceClientConfig
}

export type ConfigChangeSuggestion = DataManagementConfigSuggestions | MetadataConfigSuggestion

type DataManagementConfigSuggestions = {
  type: 'dataObjectsExclude'
  value: string
  reason?: string
}

export const isDataManagementConfigSuggestions = (suggestion: ConfigChangeSuggestion):
  suggestion is DataManagementConfigSuggestions => suggestion.type === 'dataObjectsExclude'

export type MetadataConfigSuggestion = {
  type: 'metadataExclude'
  value: MetadataQueryParams
  reason?: string
}

export const isMetadataConfigSuggestions = (suggestion: ConfigChangeSuggestion):
  suggestion is MetadataConfigSuggestion => suggestion.type === 'metadataExclude'


export type FetchElements<T> = {
  configChanges: ConfigChangeSuggestion[]
  elements: T
}

const configID = new ElemID('salesforce')

export const usernamePasswordCredentialsType = new ObjectType({
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

export const accessTokenCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accessToken: { type: BuiltinTypes.STRING },
    instanceUrl: { type: BuiltinTypes.STRING },
    isSandbox: { type: BuiltinTypes.BOOLEAN },
  },
})

export const oauthRequestParameters = new ObjectType({
  elemID: configID,
  fields: {
    consumerKey: {
      type: BuiltinTypes.STRING,
      annotations: { message: 'Consumer key for a connected app, whose redirect URI is http://localhost:port' },
    },
    port: {
      type: BuiltinTypes.NUMBER,
      annotations: { message: 'Port provided in the redirect URI' },
    },
    isSandbox: {
      type: BuiltinTypes.BOOLEAN,
      annotations: { message: 'Is connection to a sandbox?' },
    },
  },
})

export const isAccessTokenConfig = (config: Readonly<InstanceElement>): boolean =>
  config.value.authType === 'oauth'

export class UsernamePasswordCredentials {
  constructor({ username, password, isSandbox, apiToken }:
    { username: string; password: string; isSandbox: boolean; apiToken?: string }) {
    this.username = username
    this.password = password
    this.isSandbox = isSandbox
    this.apiToken = apiToken
  }

  username: string
  password: string
  apiToken?: string
  isSandbox: boolean
}

export class OauthAccessTokenCredentials {
  constructor({ instanceUrl, accessToken, isSandbox }: {
    instanceUrl: string
    accessToken: string
    isSandbox: boolean
  }) {
    this.instanceUrl = instanceUrl
    this.accessToken = accessToken
    this.isSandbox = isSandbox
  }

  instanceUrl: string
  accessToken: string
  isSandbox: boolean
}

export type Credentials = UsernamePasswordCredentials | OauthAccessTokenCredentials

const objectIdSettings = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'objectIdSettings'),
  fields: {
    objectsRegex: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    idFields: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  } as Record<keyof ObjectIdSettings, FieldDefinition>,
})

const saltoIDSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoIDSettings'),
  fields: {
    defaultIdFields: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    overrides: { type: new ListType(objectIdSettings) },
  } as Record<keyof SaltoIDSettings, FieldDefinition>,
})

const dataManagementType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, DATA_CONFIGURATION),
  fields: {
    includeObjects: { type: new ListType(BuiltinTypes.STRING) },
    excludeObjects: { type: new ListType(BuiltinTypes.STRING) },
    allowReferenceTo: { type: new ListType(BuiltinTypes.STRING) },
    saltoIDSettings: {
      type: saltoIDSettingsType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  } as Record<keyof DataManagementConfig, FieldDefinition>,
})

const clientPollingConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientPollingConfig'),
  fields: {
    interval: { type: BuiltinTypes.NUMBER },
    timeout: { type: BuiltinTypes.NUMBER },
  } as Record<keyof ClientPollingConfig, FieldDefinition>,
})

const clientDeployConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientDeployConfig'),
  fields: {
    rollbackOnError: { type: BuiltinTypes.BOOLEAN },
    ignoreWarnings: { type: BuiltinTypes.BOOLEAN },
    purgeOnDelete: { type: BuiltinTypes.BOOLEAN },
    checkOnly: { type: BuiltinTypes.BOOLEAN },
    testLevel: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
        }),
      },
    },
    runTests: { type: new ListType(BuiltinTypes.STRING) },
    deleteBeforeUpdate: { type: BuiltinTypes.BOOLEAN },
  } as Record<keyof ClientDeployConfig, FieldDefinition>,
})

const clientRateLimitConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientRateLimitConfig'),
  fields: {
    total: { type: BuiltinTypes.NUMBER },
    retrieve: { type: BuiltinTypes.NUMBER },
    read: { type: BuiltinTypes.NUMBER },
    list: { type: BuiltinTypes.NUMBER },
    query: { type: BuiltinTypes.NUMBER },
  } as Record<keyof ClientRateLimitConfig, FieldDefinition>,
})

const clientRetryConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientRetryConfig'),
  fields: {
    maxAttempts: { type: BuiltinTypes.NUMBER },
    retryDelay: { type: BuiltinTypes.NUMBER },
    retryStrategy: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: Object.keys(RetryStrategyName),
        }),
      },
    },
  } as Record<keyof ClientRetryConfig, FieldDefinition>,
})

const clientConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientConfig'),
  fields: {
    polling: { type: clientPollingConfigType },
    deploy: { type: clientDeployConfigType },
    retry: { type: clientRetryConfigType },
    maxConcurrentApiRequests: { type: clientRateLimitConfigType },
  } as Record<keyof SalesforceClientConfig, FieldDefinition>,
})

const metadataQueryType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'metadataQuery'),
  fields: {
    [METADATA_TYPE]: { type: BuiltinTypes.STRING },
    [METADATA_NAMESPACE]: { type: BuiltinTypes.STRING },
    [METADATA_NAME]: { type: BuiltinTypes.STRING },
  },
})

const metadataConfigType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'metadataConfig'),
  fields: {
    [METADATA_INCLUDE_LIST]: { type: new ListType(metadataQueryType) },
    [METADATA_EXCLUDE_LIST]: { type: new ListType(metadataQueryType) },
  },
})

const optionalFeaturesType = createMatchingObjectType<OptionalFeatures>({
  elemID: new ElemID(SALESFORCE, 'optionalFeatures'),
  fields: {
    extraDependencies: { type: BuiltinTypes.BOOLEAN },
  },
})

const fetchConfigType = createMatchingObjectType<FetchParameters>({
  elemID: new ElemID(SALESFORCE, 'fetchConfig'),
  fields: {
    metadata: { type: metadataConfigType },
    data: { type: dataManagementType },
    optionalFeatures: { type: optionalFeaturesType },
    fetchAllCustomSettings: { type: BuiltinTypes.BOOLEAN },
    target: { type: new ListType(BuiltinTypes.STRING) },
  },
})

export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [FETCH_CONFIG]: {
      type: fetchConfigType,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {
          [METADATA_CONFIG]: {
            [METADATA_INCLUDE_LIST]: [
              {
                metadataType: '.*',
                namespace: '',
                name: '.*',
              },
            ],
            [METADATA_EXCLUDE_LIST]: [
              { metadataType: 'Report' },
              { metadataType: 'ReportType' },
              { metadataType: 'ReportFolder' },
              { metadataType: 'Dashboard' },
              { metadataType: 'DashboardFolder' },
              { metadataType: 'Profile' },
              { metadataType: 'PermissionSet' },
              { metadataType: 'SiteDotCom' },
              { metadataType: 'EmailTemplate' },
              {
                metadataType: 'StandardValueSet',
                name: '^(AddressCountryCode)|(AddressStateCode)$',
                namespace: '',
              },
            ],
          },
          [SHOULD_FETCH_ALL_CUSTOM_SETTINGS]: false,
        },
      },
    },
    [MAX_ITEMS_IN_RETRIEVE_REQUEST]: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1000, max: 10000 }),
      },
    },
    [USE_OLD_PROFILES]: {
      type: BuiltinTypes.BOOLEAN,
    },
    [CLIENT_CONFIG]: {
      type: clientConfigType,
    },
    [METADATA_TYPES_SKIPPED_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
    },
    [INSTANCES_REGEX_SKIPPED_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
    },
    [DATA_MANAGEMENT]: {
      type: dataManagementType,
    },
  },
})
