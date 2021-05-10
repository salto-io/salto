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
  SaltoError,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
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

export type FilterResult = {
  configSuggestions?: ConfigChangeSuggestion[]
  errors?: SaltoError[]
}

export type ConfigChangeSuggestion = DataManagementConfigSuggestions | MetadataConfigSuggestion

type DataManagementConfigSuggestions = {
  type: 'dataObjectsExclude'
  value: string
  reason?: string
}

export type MetadataConfigSuggestion = {
  type: 'metadataExclude'
  value: MetadataQueryParams
  reason?: string
}

export const isDataManagementConfigSuggestions = (suggestion: ConfigChangeSuggestion):
  suggestion is DataManagementConfigSuggestions => suggestion.type === 'dataObjectsExclude'

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
    username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    password: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    token: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: { message: 'Token (empty if your org uses IP whitelisting)' },
    },
    sandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  },
})

export const accessTokenCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accessToken: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    instanceUrl: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    isSandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  },
})

export const oauthRequestParameters = new ObjectType({
  elemID: configID,
  fields: {
    consumerKey: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: { message: 'Consumer key for a connected app, whose redirect URI is http://localhost:port' },
    },
    port: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: { message: 'Port provided in the redirect URI' },
    },
    isSandbox: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    idFields: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
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
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    overrides: {
      refType: createRefToElmWithValue(new ListType(objectIdSettings)),
    },
  } as Record<keyof SaltoIDSettings, FieldDefinition>,
})

const dataManagementType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, DATA_CONFIGURATION),
  fields: {
    includeObjects: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
    },
    excludeObjects: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
    },
    allowReferenceTo: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
    },
    saltoIDSettings: {
      refType: createRefToElmWithValue(saltoIDSettingsType),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  } as Record<keyof DataManagementConfig, FieldDefinition>,
})

const clientPollingConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientPollingConfig'),
  fields: {
    interval: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    timeout: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
  } as Record<keyof ClientPollingConfig, FieldDefinition>,
})

const clientDeployConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientDeployConfig'),
  fields: {
    rollbackOnError: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    ignoreWarnings: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    purgeOnDelete: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    checkOnly: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    testLevel: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
        }),
      },
    },
    runTests: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)) },
    deleteBeforeUpdate: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  } as Record<keyof ClientDeployConfig, FieldDefinition>,
})

const clientRateLimitConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientRateLimitConfig'),
  fields: {
    total: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    retrieve: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    read: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    list: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    query: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },

  } as Record<keyof ClientRateLimitConfig, FieldDefinition>,
})

const clientRetryConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientRetryConfig'),
  fields: {
    maxAttempts: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    retryDelay: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    retryStrategy: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
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
    polling: { refType: createRefToElmWithValue(clientPollingConfigType) },
    deploy: { refType: createRefToElmWithValue(clientDeployConfigType) },
    retry: { refType: createRefToElmWithValue(clientRetryConfigType) },
    maxConcurrentApiRequests: { refType: createRefToElmWithValue(clientRateLimitConfigType) },
  } as Record<keyof SalesforceClientConfig, FieldDefinition>,
})

const metadataQueryType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'metadataQuery'),
  fields: {
    [METADATA_TYPE]: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    [METADATA_NAMESPACE]: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    [METADATA_NAME]: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
  },
})

const metadataConfigType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'metadataConfig'),
  fields: {
    [METADATA_INCLUDE_LIST]: { refType: createRefToElmWithValue(new ListType(metadataQueryType)) },
    [METADATA_EXCLUDE_LIST]: { refType: createRefToElmWithValue(new ListType(metadataQueryType)) },
  },
})

const optionalFeaturesType = createMatchingObjectType<OptionalFeatures>({
  elemID: new ElemID(SALESFORCE, 'optionalFeatures'),
  fields: {
    extraDependencies: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  },
})

const fetchConfigType = createMatchingObjectType<FetchParameters>({
  elemID: new ElemID(SALESFORCE, 'fetchConfig'),
  fields: {
    metadata: { refType: createRefToElmWithValue(metadataConfigType) },
    data: { refType: createRefToElmWithValue(dataManagementType) },
    optionalFeatures: { refType: createRefToElmWithValue(optionalFeaturesType) },
    fetchAllCustomSettings:  { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    target: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)) },
  },
})

export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [FETCH_CONFIG]: {
      refType: createRefToElmWithValue(fetchConfigType),
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
              { metadataType: 'ContentAsset' },
              { metadataType: 'CustomObjectTranslation' },
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
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1000, max: 10000 }),
      },
    },
    [USE_OLD_PROFILES]: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
    },
    [CLIENT_CONFIG]: {
      refType: createRefToElmWithValue(clientConfigType),
    },
    [METADATA_TYPES_SKIPPED_LIST]: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
    },
    [INSTANCES_REGEX_SKIPPED_LIST]: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
    },
    [DATA_MANAGEMENT]: {
      refType: createRefToElmWithValue(dataManagementType),
    },
  },
})
