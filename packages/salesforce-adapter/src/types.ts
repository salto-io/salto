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
  ElemID, ObjectType, InstanceElement, BuiltinTypes, CORE_ANNOTATIONS, ListType, createRestriction,
  FieldDefinition,
} from '@salto-io/adapter-api'
import * as constants from './constants'

export const METADATA_TYPES_SKIPPED_LIST = 'metadataTypesSkippedList'
export const UNSUPPORTED_SYSTEM_FIELDS = 'unsupportedSystemFields'
export const DATA_MANAGEMENT = 'dataManagement'
export const CLIENT_CONFIG = 'client'
export const INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList'
export const MAX_CONCURRENT_RETRIEVE_REQUESTS = 'maxConcurrentRetrieveRequests'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'
export const ENABLE_HIDE_TYPES_IN_NACLS = 'enableHideTypesInNacls'
export const SYSTEM_FIELDS = 'systemFields'
export const USE_OLD_PROFILES = 'useOldProfiles'

export type FilterContext = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: RegExp[]
  [UNSUPPORTED_SYSTEM_FIELDS]?: string[]
  [DATA_MANAGEMENT]?: DataManagementConfig
  [SYSTEM_FIELDS]?: string[]
  [ENABLE_HIDE_TYPES_IN_NACLS]?: boolean
  [USE_OLD_PROFILES]?: boolean
}

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

type ClientPollingConfig = Partial<{
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
}>

export type SalesforceClientConfig = Partial<{
  polling: ClientPollingConfig
  deploy: ClientDeployConfig
}>

export type SalesforceConfig = {
  [METADATA_TYPES_SKIPPED_LIST]?: string[]
  [INSTANCES_REGEX_SKIPPED_LIST]?: string[]
  [MAX_CONCURRENT_RETRIEVE_REQUESTS]?: number
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]?: number
  [ENABLE_HIDE_TYPES_IN_NACLS]?: boolean
  [USE_OLD_PROFILES]?: boolean
  [DATA_MANAGEMENT]?: DataManagementConfig
  [CLIENT_CONFIG]?: SalesforceClientConfig
}

export type ConfigChangeSuggestion = {
  type: keyof SalesforceConfig & ('metadataTypesSkippedList' | 'instancesRegexSkippedList' | 'dataManagement')
  value: string
  reason?: string
}
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
  elemID: new ElemID(constants.SALESFORCE, DATA_MANAGEMENT),
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
  } as Record<keyof ClientDeployConfig, FieldDefinition>,
})

const clientConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'clientConfig'),
  fields: {
    polling: { type: clientPollingConfigType },
    deploy: { type: clientDeployConfigType },
  } as Record<keyof SalesforceClientConfig, FieldDefinition>,
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

          // We currently can't deploy them or edit them after they are created:
          '^StandardValueSet.AddressCountryCode',
          '^StandardValueSet.AddressStateCode',
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
    [USE_OLD_PROFILES]: {
      type: BuiltinTypes.BOOLEAN,
    },
    [DATA_MANAGEMENT]: {
      type: dataManagementType,
    },
    [CLIENT_CONFIG]: {
      type: clientConfigType,
    },
  },
})
