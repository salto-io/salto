/*
*                      Copyright 2022 Salto Labs Ltd.
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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
  ElemID,
  FieldDefinition,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
} from '@salto-io/adapter-api'
import { SUPPORTED_METADATA_TYPES } from './fetch_profile/metadata_types'
import * as constants from './constants'
import { DEFAULT_MAX_INSTANCES_PER_TYPE } from './constants'

export const CLIENT_CONFIG = 'client'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'
export const MAX_INSTANCES_PER_TYPE = 'maxInstancesPerType'
export const CUSTOM_OBJECTS_DEPLOY_RETRY_OPTIONS = 'customObjectsDeployRetryOptions'
export const FETCH_CONFIG = 'fetch'
export const METADATA_CONFIG = 'metadata'
export const METADATA_INCLUDE_LIST = 'include'
export const METADATA_EXCLUDE_LIST = 'exclude'
const METADATA_TYPE = 'metadataType'
const METADATA_NAME = 'name'
const METADATA_NAMESPACE = 'namespace'
export const METADATA_SEPARATE_FIELD_LIST = 'objectsToSeperateFieldsToFiles'
export const DATA_CONFIGURATION = 'data'
export const METADATA_TYPES_SKIPPED_LIST = 'metadataTypesSkippedList'
export const DATA_MANAGEMENT = 'dataManagement'
export const INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList'
export const SHOULD_FETCH_ALL_CUSTOM_SETTINGS = 'fetchAllCustomSettings'
export const ENUM_FIELD_PERMISSIONS = 'enumFieldPermissions'

// Based on the list in https://salesforce.stackexchange.com/questions/101844/what-are-the-object-and-field-name-suffixes-that-salesforce-uses-such-as-c-an
export const INSTANCE_SUFFIXES = [
  'c', 'r', 'ka', 'kav', 'Feed', 'ViewStat', 'VoteStat', 'DataCategorySelection', 'x', 'xo', 'mdt', 'Share', 'Tag',
  'History', 'pc', 'pr', 'hd', 'hqr', 'hst', 'b', 'latitude__s', 'longitude__s', 'e', 'p', 'ChangeEvent', 'chn',
]

export type MetadataInstance = {
  metadataType: string
  namespace: string
  name: string
  isFolderType: boolean
}

export type MetadataQueryParams = Partial<Omit<MetadataInstance, 'isFolderType'>>

export type MetadataParams = {
  include?: MetadataQueryParams[]
  exclude?: MetadataQueryParams[]
  objectsToSeperateFieldsToFiles?: string[]
}

export type OptionalFeatures = {
  extraDependencies?: boolean
  elementsUrls?: boolean
  profilePaths?: boolean
  addMissingIds?: boolean
  authorInformation?: boolean
  describeSObjects?: boolean
}

export type ChangeValidatorName = (
  'managedPackage'
  | 'picklistStandardField'
  | 'customObjectInstances'
  | 'unknownField'
  | 'customFieldType'
  | 'standardFieldLabel'
  | 'mapKeys'
  | 'multipleDefaults'
  | 'picklistPromote'
  | 'cpqValidator'
  | 'sbaaApprovalRulesCustomCondition'
  | 'recordTypeDeletion'
  | 'flowsValidator'
  | 'fullNameChangedValidator'
  | 'invalidListViewFilterScope'
  | 'caseAssignmentRulesValidator'
  | 'omitData'
  | 'unknownUser'
)

export type ChangeValidatorConfig = Partial<Record<ChangeValidatorName, boolean>>

type ObjectIdSettings = {
  objectsRegex: string
  idFields: string[]
}

export type SaltoIDSettings = {
  defaultIdFields: string[]
  overrides?: ObjectIdSettings[]
}

const objectIdSettings = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'objectIdSettings'),
  fields: {
    objectsRegex: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    idFields: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  } as Record<keyof ObjectIdSettings, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const saltoIDSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoIDSettings'),
  fields: {
    defaultIdFields: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    overrides: {
      refType: new ListType(objectIdSettings),
    },
  } as Record<keyof SaltoIDSettings, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type DataManagementConfig = {
  includeObjects: string[]
  excludeObjects?: string[]
  allowReferenceTo?: string[]
  ignoreReferenceTo?: string[]
  saltoIDSettings: SaltoIDSettings
  showReadOnlyValues?: boolean
}

export type FetchParameters = {
  metadata?: MetadataParams
  data?: DataManagementConfig
  fetchAllCustomSettings?: boolean // TODO - move this into optional features
  optionalFeatures?: OptionalFeatures
  target?: string[]
  maxInstancesPerType?: number
  preferActiveFlowVersions?: boolean
}

export type DeprecatedMetadataParams = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: string[]
}

export type DeprecatedFetchParameters = {
  [DATA_MANAGEMENT]?: DataManagementConfig
} & DeprecatedMetadataParams

export type ClientRateLimitConfig = Partial<{
  total: number
  retrieve: number
  read: number
  list: number
  query: number
  describe: number
  deploy: number
}>

export type ClientPollingConfig = Partial<{
  interval: number
  deployTimeout: number
  fetchTimeout: number
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
  timeout: number
}>

export type CustomObjectsDeployRetryConfig = {
  maxAttempts: number
  retryDelay: number
  retryableFailures: string[]
}

export type ReadMetadataChunkSizeConfig = {
  default?: number
  overrides?: Record<string, number>
}

export type SalesforceClientConfig = Partial<{
  polling: ClientPollingConfig
  deploy: ClientDeployConfig
  maxConcurrentApiRequests: ClientRateLimitConfig
  retry: ClientRetryConfig
  dataRetry: CustomObjectsDeployRetryConfig
  readMetadataChunkSize: ReadMetadataChunkSizeConfig
}>

export type SalesforceConfig = {
  [FETCH_CONFIG]?: FetchParameters
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]?: number
  [CLIENT_CONFIG]?: SalesforceClientConfig
  [ENUM_FIELD_PERMISSIONS]?: boolean
  validators?: ChangeValidatorConfig
}

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

export type RetrieveSizeConfigSuggstion = {
  type: typeof MAX_ITEMS_IN_RETRIEVE_REQUEST
  value: number
  reason?: string
}

export type ConfigChangeSuggestion =
    DataManagementConfigSuggestions
  | MetadataConfigSuggestion
  | RetrieveSizeConfigSuggstion

export const isDataManagementConfigSuggestions = (suggestion: ConfigChangeSuggestion):
  suggestion is DataManagementConfigSuggestions => suggestion.type === 'dataObjectsExclude'

export const isMetadataConfigSuggestions = (suggestion: ConfigChangeSuggestion):
  suggestion is MetadataConfigSuggestion => suggestion.type === 'metadataExclude'

export const isRetrieveSizeConfigSuggstion = (suggestion: ConfigChangeSuggestion):
  suggestion is RetrieveSizeConfigSuggstion => suggestion.type === MAX_ITEMS_IN_RETRIEVE_REQUEST

export type FetchElements<T> = {
  configChanges: ConfigChangeSuggestion[]
  elements: T
}

const configID = new ElemID('salesforce')

export const usernamePasswordCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    username: { refType: BuiltinTypes.STRING },
    password: { refType: BuiltinTypes.STRING },
    token: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Token (empty if your org uses IP whitelisting)' },
    },
    sandbox: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const accessTokenCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accessToken: { refType: BuiltinTypes.STRING },
    instanceUrl: { refType: BuiltinTypes.STRING },
    sandbox: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const oauthRequestParameters = new ObjectType({
  elemID: configID,
  fields: {
    consumerKey: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Consumer key for a connected app, whose redirect URI is http://localhost:port' },
    },
    consumerSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Consumer secret for a connected app, whose redirect URI is http://localhost:port' },
    },
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: { message: 'Port provided in the redirect URI' },
    },
    sandbox: {
      refType: BuiltinTypes.BOOLEAN,
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
  constructor({ instanceUrl, accessToken, refreshToken, isSandbox, clientId, clientSecret }: {
    instanceUrl: string
    accessToken: string
    refreshToken: string
    clientId: string
    clientSecret: string
    isSandbox: boolean
  }) {
    this.instanceUrl = instanceUrl
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.isSandbox = isSandbox
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  instanceUrl: string
  accessToken: string
  refreshToken: string
  isSandbox: boolean
  clientId: string
  clientSecret: string
}

export type Credentials = UsernamePasswordCredentials | OauthAccessTokenCredentials

const dataManagementType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, DATA_CONFIGURATION),
  fields: {
    includeObjects: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    excludeObjects: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    allowReferenceTo: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    saltoIDSettings: {
      refType: saltoIDSettingsType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  } as Record<keyof DataManagementConfig, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const clientPollingConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientPollingConfig'),
  fields: {
    interval: { refType: BuiltinTypes.NUMBER },
    deployTimeout: { refType: BuiltinTypes.NUMBER },
    fetchTimeout: { refType: BuiltinTypes.NUMBER },
  } as Record<keyof ClientPollingConfig, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const clientDeployConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientDeployConfig'),
  fields: {
    rollbackOnError: { refType: BuiltinTypes.BOOLEAN },
    ignoreWarnings: { refType: BuiltinTypes.BOOLEAN },
    purgeOnDelete: { refType: BuiltinTypes.BOOLEAN },
    checkOnly: { refType: BuiltinTypes.BOOLEAN },
    testLevel: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
        }),
      },
    },
    runTests: { refType: new ListType(BuiltinTypes.STRING) },
    deleteBeforeUpdate: { refType: BuiltinTypes.BOOLEAN },
  } as Record<keyof ClientDeployConfig, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const clientRateLimitConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientRateLimitConfig'),
  fields: {
    total: { refType: BuiltinTypes.NUMBER },
    retrieve: { refType: BuiltinTypes.NUMBER },
    read: { refType: BuiltinTypes.NUMBER },
    list: { refType: BuiltinTypes.NUMBER },
    query: { refType: BuiltinTypes.NUMBER },
    describe: { refType: BuiltinTypes.NUMBER },
    deploy: { refType: BuiltinTypes.NUMBER },

  } as Record<keyof ClientRateLimitConfig, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const clientRetryConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientRetryConfig'),
  fields: {
    maxAttempts: { refType: BuiltinTypes.NUMBER },
    retryDelay: { refType: BuiltinTypes.NUMBER },
    retryStrategy: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: Object.keys(RetryStrategyName),
        }),
      },
    },
    timeout: { refType: BuiltinTypes.NUMBER },
  } as Record<keyof ClientRetryConfig, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const readMetadataChunkSizeConfigType = createMatchingObjectType<ReadMetadataChunkSizeConfig>({
  elemID: new ElemID(constants.SALESFORCE, 'readMetadataChunkSizeConfig'),
  fields: {
    default: { refType: BuiltinTypes.NUMBER },
    overrides: {
      refType: new MapType(BuiltinTypes.NUMBER),
      annotations: { [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1, max: 10 }) },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const clientConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientConfig'),
  fields: {
    polling: { refType: clientPollingConfigType },
    deploy: { refType: clientDeployConfigType },
    retry: { refType: clientRetryConfigType },
    maxConcurrentApiRequests: { refType: clientRateLimitConfigType },
    readMetadataChunkSize: { refType: readMetadataChunkSizeConfigType },
  } as Record<keyof SalesforceClientConfig, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const metadataQueryType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'metadataQuery'),
  fields: {
    [METADATA_TYPE]: { refType: BuiltinTypes.STRING },
    [METADATA_NAMESPACE]: { refType: BuiltinTypes.STRING },
    [METADATA_NAME]: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const metadataConfigType = createMatchingObjectType<MetadataParams>({
  elemID: new ElemID(constants.SALESFORCE, 'metadataConfig'),
  fields: {
    [METADATA_INCLUDE_LIST]: { refType: new ListType(metadataQueryType) },
    [METADATA_EXCLUDE_LIST]: { refType: new ListType(metadataQueryType) },
    [METADATA_SEPARATE_FIELD_LIST]: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          max_length: constants.MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD,
        }),
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const optionalFeaturesType = createMatchingObjectType<OptionalFeatures>({
  elemID: new ElemID(constants.SALESFORCE, 'optionalFeatures'),
  fields: {
    extraDependencies: { refType: BuiltinTypes.BOOLEAN },
    elementsUrls: { refType: BuiltinTypes.BOOLEAN },
    profilePaths: { refType: BuiltinTypes.BOOLEAN },
    addMissingIds: { refType: BuiltinTypes.BOOLEAN },
    authorInformation: { refType: BuiltinTypes.BOOLEAN },
    describeSObjects: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const changeValidatorConfigType = createMatchingObjectType<ChangeValidatorConfig>({
  elemID: new ElemID(constants.SALESFORCE, 'changeValidatorConfig'),
  fields: {
    managedPackage: { refType: BuiltinTypes.BOOLEAN },
    picklistStandardField: { refType: BuiltinTypes.BOOLEAN },
    customObjectInstances: { refType: BuiltinTypes.BOOLEAN },
    unknownField: { refType: BuiltinTypes.BOOLEAN },
    customFieldType: { refType: BuiltinTypes.BOOLEAN },
    standardFieldLabel: { refType: BuiltinTypes.BOOLEAN },
    mapKeys: { refType: BuiltinTypes.BOOLEAN },
    multipleDefaults: { refType: BuiltinTypes.BOOLEAN },
    picklistPromote: { refType: BuiltinTypes.BOOLEAN },
    cpqValidator: { refType: BuiltinTypes.BOOLEAN },
    sbaaApprovalRulesCustomCondition: { refType: BuiltinTypes.BOOLEAN },
    recordTypeDeletion: { refType: BuiltinTypes.BOOLEAN },
    flowsValidator: { refType: BuiltinTypes.BOOLEAN },
    fullNameChangedValidator: { refType: BuiltinTypes.BOOLEAN },
    invalidListViewFilterScope: { refType: BuiltinTypes.BOOLEAN },
    caseAssignmentRulesValidator: { refType: BuiltinTypes.BOOLEAN },
    omitData: { refType: BuiltinTypes.BOOLEAN },
    unknownUser: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fetchConfigType = createMatchingObjectType<FetchParameters>({
  elemID: new ElemID(constants.SALESFORCE, 'fetchConfig'),
  fields: {
    metadata: { refType: metadataConfigType },
    data: { refType: dataManagementType },
    optionalFeatures: { refType: optionalFeaturesType },
    fetchAllCustomSettings: { refType: BuiltinTypes.BOOLEAN },
    target: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          enforce_value: true,
          values: SUPPORTED_METADATA_TYPES,
        }),
      },
    },
    maxInstancesPerType: { refType: BuiltinTypes.NUMBER },
    preferActiveFlowVersions: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const configType = createMatchingObjectType<SalesforceConfig>({
  elemID: configID,
  fields: {
    [FETCH_CONFIG]: {
      refType: fetchConfigType,
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
              { metadataType: 'Document' },
              { metadataType: 'DocumentFolder' },
              { metadataType: 'Profile' },
              { metadataType: 'PermissionSet' },
              { metadataType: 'SiteDotCom' },
              {
                metadataType: 'EmailTemplate',
                name: '^MarketoEmailTemplates/*',
              },
              { metadataType: 'ContentAsset' },
              { metadataType: 'CustomObjectTranslation' },
              { metadataType: 'AnalyticSnapshot' },
              { metadataType: 'WaveDashboard' },
              { metadataType: 'WaveDataflow' },
              {
                metadataType: 'StandardValueSet',
                name: '^(AddressCountryCode)|(AddressStateCode)$',
                namespace: '',
              },
              {
                metadataType: 'Layout',
                name: 'CollaborationGroup-Group Layout',
              },
              {
                metadataType: 'Layout',
                name: 'CaseInteraction-Case Feed Layout',
              },
            ],
          },
          [SHOULD_FETCH_ALL_CUSTOM_SETTINGS]: false,
          [MAX_INSTANCES_PER_TYPE]: DEFAULT_MAX_INSTANCES_PER_TYPE,
        },
      },
    },
    [MAX_ITEMS_IN_RETRIEVE_REQUEST]: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: constants.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST,
          max: constants.MAXIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        }),
      },
    },
    [ENUM_FIELD_PERMISSIONS]: {
      refType: BuiltinTypes.BOOLEAN,
    },
    [CLIENT_CONFIG]: {
      refType: clientConfigType,
    },
    validators: {
      refType: changeValidatorConfigType,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})
