/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createMatchingObjectType, ImportantValues } from '@salto-io/adapter-utils'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
  ElemID,
  FieldDefinition,
  importantValueType,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { definitions, WeakReferencesHandler as ComponentsWeakReferencesHandler } from '@salto-io/adapter-components'
import { types } from '@salto-io/lowerdash'
import { SUPPORTED_METADATA_TYPES } from './fetch_profile/metadata_types'
import * as constants from './constants'

type UserDeployConfig = definitions.UserDeployConfig

export const CLIENT_CONFIG = 'client'
export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest'
export const MAX_INSTANCES_PER_TYPE = 'maxInstancesPerType'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'
export const METADATA_CONFIG = 'metadata'
export const CUSTOM_REFS_CONFIG = 'customReferences'
export const FIX_ELEMENTS_CONFIG = 'fixElements'
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
const SHOULD_FETCH_ALL_CUSTOM_SETTINGS = 'fetchAllCustomSettings'

// Based on the list in https://salesforce.stackexchange.com/questions/101844/what-are-the-object-and-field-name-suffixes-that-salesforce-uses-such-as-c-an
export const INSTANCE_SUFFIXES = [
  'c',
  'r',
  'ka',
  'kav',
  'Feed',
  'ViewStat',
  'VoteStat',
  'DataCategorySelection',
  'x',
  'xo',
  'mdt',
  'Share',
  'Tag',
  'History',
  'pc',
  'pr',
  'hd',
  'hqr',
  'hst',
  'b',
  'latitude__s',
  'longitude__s',
  'e',
  'p',
  'ChangeEvent',
  'chn',
  'gvs',
]

export type MetadataInstance = {
  metadataType: string
  namespace: string
  name: string
  isFolderType: boolean
  changedAt: string | undefined
}

export type MetadataQueryParams = Partial<Omit<MetadataInstance, 'isFolderType'>>

export type MetadataParams = {
  include?: MetadataQueryParams[]
  exclude?: MetadataQueryParams[]
  objectsToSeperateFieldsToFiles?: string[]
}

const OPTIONAL_FEATURES = [
  'extendedCustomFieldInformation',
  'hideTypesFolder',
  'metaTypes',
  'picklistsAsMaps',
  'retrieveSettings',
  'genAiReferences',
  'networkReferences',
  'extendFetchTargets',
  'addParentToInstancesWithinFolder',
  'shouldPopulateInternalIdAfterDeploy',
  'packageVersionReference',
  'omitTotalTrustedRequestsUsageField',
  'supportProfileTabVisibilities',
  'disablePermissionsOmissions',
  'omitStandardFieldsNonDeployableValues',
  'handleInsufficientAccessRightsOnEntity',
  'shuffleRetrieveInstances',
] as const
const DEPRECATED_OPTIONAL_FEATURES = [
  'addMissingIds',
  'authorInformation',
  'cpqRulesAndConditionsRefs',
  'describeSObjects',
  'elementsUrls',
  'excludeNonRetrievedProfilesRelatedInstances',
  'extendTriggersMetadata',
  'extraDependencies',
  'extraDependenciesV2',
  'fetchCustomObjectUsingRetrieveApi',
  'fetchProfilesUsingReadApi',
  'flowCoordinates',
  'formulaDeps',
  'generateRefsInProfiles',
  'importantValues',
  'improvedDataBrokenReferences',
  'indexedEmailTemplateAttachments',
  'lightningPageFieldItemReference',
  'logDiffsFromParsingXmlNumbers',
  'profilePaths',
  'removeReferenceFromFilterItemToRecordType',
  'sharingRulesMaps',
  'skipAliases',
  'skipParsingXmlNumbers',
  'storeProfilesAndPermissionSetsBrokenPaths',
  'taskAndEventCustomFields',
  'toolingDepsOfCurrentNamespace',
  'useLabelAsAlias',
  'waveMetadataSupport',
] as const
export type OptionalFeatures = {
  [key in (typeof OPTIONAL_FEATURES)[number]]?: boolean
}

const CHANGE_VALIDATORS = [
  'managedPackage',
  'picklistStandardField',
  'customObjectInstances',
  'customFieldType',
  'standardFieldLabel',
  'mapKeys',
  'defaultRules',
  'packageVersion',
  'picklistPromote',
  'cpqValidator',
  'recordTypeDeletion',
  'flowsValidator',
  'fullNameChangedValidator',
  'invalidListViewFilterScope',
  'caseAssignmentRulesValidator',
  'omitData',
  'unknownUser',
  'animationRuleRecordType',
  'currencyIsoCodes',
  'dataChange',
  'duplicateRulesSortOrder',
  'lastLayoutRemoval',
  'accountSettings',
  'unknownPicklistValues',
  'installedPackages',
  'dataCategoryGroup',
  'standardFieldOrObjectAdditionsOrDeletions',
  'deletedNonQueryableFields',
  'instanceWithUnknownType',
  'artificialTypes',
  'metadataTypes',
  'taskOrEventFieldsModifications',
  'newFieldsAndObjectsFLS',
  'elementApiVersion',
  'cpqBillingStartDate',
  'cpqBillingTriggers',
  'managedApexComponent',
  'orderedMaps',
  'layoutDuplicateFields',
  'customApplications',
  'flowReferencedElements',
  'liveChatButtonRoutingType',
  'flexiPageUnusedOrMissingFacets',
  'uniqueFlowElementName',
  'accessToSendEmail',
] as const
const DEPRECATED_CHANGE_VALIDATORS = ['multipleDefaults'] as const
export type ChangeValidatorName = (typeof CHANGE_VALIDATORS)[number]

type ObjectIdSettings = {
  objectsRegex: string
  idFields: string[]
}

type ObjectAliasSettings = {
  objectsRegex: string
  aliasFields: string[]
}

export type SaltoIDSettings = {
  defaultIdFields: string[]
  overrides?: ObjectIdSettings[]
  regenerateSaltoIds?: boolean
}

export type SaltoAliasSettings = {
  defaultAliasFields?: types.NonEmptyArray<string>
  overrides?: ObjectAliasSettings[]
}

type SaltoManagementFieldSettings = {
  defaultFieldName: string
}

export const outgoingReferenceBehaviors = ['ExcludeInstance', 'BrokenReference', 'InternalId'] as const
export type OutgoingReferenceBehavior = (typeof outgoingReferenceBehaviors)[number]

type BrokenOutgoingReferencesSettings = {
  defaultBehavior: OutgoingReferenceBehavior
  perTargetTypeOverrides?: Record<string, OutgoingReferenceBehavior>
}

const customReferencesHandlersNames = [
  'profilesAndPermissionSets',
  'managedElements',
  'formulaRefs',
  'omitNonExistingFields',
] as const
export type CustomReferencesHandlers = (typeof customReferencesHandlersNames)[number]

export type CustomReferencesSettings = Partial<Record<CustomReferencesHandlers, boolean>>

export type FixElementsSettings = Partial<Record<CustomReferencesHandlers, boolean>>

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
    regenerateSaltoIds: {
      refType: BuiltinTypes.BOOLEAN,
    },
  } as Record<keyof SaltoIDSettings, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const objectAliasSettings = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'objectAliasSettings'),
  fields: {
    objectsRegex: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    aliasFields: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  } as Record<keyof ObjectAliasSettings, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const saltoAliasSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoAliasSettings'),
  fields: {
    defaultAliasFields: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    overrides: {
      refType: new ListType(objectAliasSettings),
    },
  } as Record<keyof SaltoAliasSettings, FieldDefinition>,
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const saltoManagementFieldSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoManagementFieldSettings'),
  fields: {
    defaultFieldName: {
      refType: BuiltinTypes.STRING,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const brokenOutgoingReferencesSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'brokenOutgoingReferencesSettings'),
  fields: {
    defaultBehavior: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: outgoingReferenceBehaviors,
        }),
      },
    },
    perTargetTypeOverrides: {
      refType: new MapType(BuiltinTypes.STRING),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const customReferencesSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoCustomReferencesSettings'),
  fields: Object.fromEntries(customReferencesHandlersNames.map(name => [name, { refType: BuiltinTypes.BOOLEAN }])),
})

const fixElementsSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoFixElementsSettings'),
  fields: Object.fromEntries(customReferencesHandlersNames.map(name => [name, { refType: BuiltinTypes.BOOLEAN }])),
})

const warningSettingsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'saltoWarningSettings'),
  fields: {
    nonQueryableFields: {
      refType: BuiltinTypes.BOOLEAN,
    },
  },
})

type WarningSettings = {
  nonQueryableFields: boolean
}

export type DataManagementConfig = {
  includeObjects: string[]
  excludeObjects?: string[]
  allowReferenceTo?: string[]
  saltoIDSettings: SaltoIDSettings
  showReadOnlyValues?: boolean
  saltoAliasSettings?: SaltoAliasSettings
  saltoManagementFieldSettings?: SaltoManagementFieldSettings
  brokenOutgoingReferencesSettings?: BrokenOutgoingReferencesSettings
  omittedFields?: string[]
  regenerateSaltoIds?: boolean
}

type FetchLimits = {
  maxExtraDependenciesQuerySize?: number
  maxExtraDependenciesResponseSize?: number
  extendTriggersMetadataChunkSize?: number
  flowDefinitionsQueryChunkSize?: number
}

export type FetchParameters = {
  metadata?: MetadataParams
  data?: DataManagementConfig
  fetchAllCustomSettings?: boolean // TODO - move this into optional features
  optionalFeatures?: OptionalFeatures
  target?: string[]
  limits?: FetchLimits
  maxInstancesPerType?: number // TODO - move this into fetchLimits
  preferActiveFlowVersions?: boolean
  addNamespacePrefixToFullName?: boolean
  warningSettings?: WarningSettings
  additionalImportantValues?: ImportantValues
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

export type QuickDeployParams = {
  requestId: string
  hash: string
}

export type ClientDeployConfig = Partial<{
  rollbackOnError: boolean
  ignoreWarnings: boolean
  purgeOnDelete: boolean
  checkOnly: boolean
  testLevel: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg'
  runTests: string[]
  deleteBeforeUpdate: boolean
  quickDeployParams: QuickDeployParams
  performRetrieve: boolean
  flsProfiles: string[]
}>

export const RETRY_STRATEGY_NAMES = ['HttpError', 'HTTPOrNetworkError', 'NetworkError'] as const
type RetryStrategy = (typeof RETRY_STRATEGY_NAMES)[number]
export type ClientRetryConfig = Partial<{
  maxAttempts: number
  retryDelay: number
  retryStrategy: RetryStrategy
  timeout: number
}>

export type CustomObjectsDeployRetryConfig = {
  maxAttempts: number
  retryDelay: number
  retryDelayMultiplier: number
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
  [DEPLOY_CONFIG]?: UserDeployConfig
  [CUSTOM_REFS_CONFIG]?: CustomReferencesSettings
  [FIX_ELEMENTS_CONFIG]?: FixElementsSettings
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

type RetrieveSizeConfigSuggestion = {
  type: typeof MAX_ITEMS_IN_RETRIEVE_REQUEST
  value: number
  reason?: string
}

export type ConfigChangeSuggestion =
  | DataManagementConfigSuggestions
  | MetadataConfigSuggestion
  | RetrieveSizeConfigSuggestion

export const isDataManagementConfigSuggestions = (
  suggestion: ConfigChangeSuggestion,
): suggestion is DataManagementConfigSuggestions => suggestion.type === 'dataObjectsExclude'

export const isMetadataConfigSuggestions = (
  suggestion: ConfigChangeSuggestion,
): suggestion is MetadataConfigSuggestion => suggestion.type === 'metadataExclude'

export const isRetrieveSizeConfigSuggestion = (
  suggestion: ConfigChangeSuggestion,
): suggestion is RetrieveSizeConfigSuggestion => suggestion.type === MAX_ITEMS_IN_RETRIEVE_REQUEST

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
      annotations: {
        message: 'Token (empty if your org uses IP whitelisting)',
      },
    },
    sandbox: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { message: 'Is Sandbox/Scratch Org' },
    },
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
      annotations: {
        message: 'Consumer key for a connected app, whose redirect URI is http://localhost:port',
      },
    },
    consumerSecret: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Consumer secret for a connected app, whose redirect URI is http://localhost:port',
      },
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

export const isAccessTokenConfig = (config: Readonly<InstanceElement>): boolean => config.value.authType === 'oauth'

export class UsernamePasswordCredentials {
  constructor({
    username,
    password,
    isSandbox,
    apiToken,
  }: {
    username: string
    password: string
    isSandbox: boolean
    apiToken?: string
  }) {
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
  constructor({
    instanceUrl,
    accessToken,
    refreshToken,
    isSandbox,
    clientId,
    clientSecret,
  }: {
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
    saltoAliasSettings: {
      refType: saltoAliasSettingsType,
    },
    saltoManagementFieldSettings: {
      refType: saltoManagementFieldSettingsType,
    },
    brokenOutgoingReferencesSettings: {
      refType: brokenOutgoingReferencesSettingsType,
    },
    omittedFields: {
      refType: new ListType(BuiltinTypes.STRING),
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

const QuickDeployParamsType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'quickDeployParams'),
  fields: {
    requestId: { refType: BuiltinTypes.STRING },
    hash: { refType: BuiltinTypes.STRING },
  } as Record<keyof QuickDeployParams, FieldDefinition>,
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
    quickDeployParams: { refType: QuickDeployParamsType },
    performRetrieve: { refType: BuiltinTypes.BOOLEAN },
    flsProfiles: { refType: new ListType(BuiltinTypes.STRING) },
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
    retryDelayMultiplier: { refType: BuiltinTypes.NUMBER },
    retryStrategy: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: RETRY_STRATEGY_NAMES,
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
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 10,
        }),
      },
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

const optionalFeaturesType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'optionalFeatures'),
  fields: Object.fromEntries(
    (OPTIONAL_FEATURES as readonly string[])
      .concat(DEPRECATED_OPTIONAL_FEATURES)
      .map(name => [name, { refType: BuiltinTypes.BOOLEAN }]),
  ),
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const changeValidatorConfigType = new ObjectType({
  elemID: new ElemID(constants.SALESFORCE, 'changeValidatorConfig'),
  fields: Object.fromEntries(
    (CHANGE_VALIDATORS as readonly string[])
      .concat(DEPRECATED_CHANGE_VALIDATORS)
      .map(name => [name, { refType: BuiltinTypes.BOOLEAN }]),
  ),
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const limitsType = createMatchingObjectType<FetchLimits>({
  elemID: new ElemID(constants.SALESFORCE, 'limits'),
  fields: {
    maxExtraDependenciesQuerySize: { refType: BuiltinTypes.NUMBER },
    maxExtraDependenciesResponseSize: { refType: BuiltinTypes.NUMBER },
    extendTriggersMetadataChunkSize: { refType: BuiltinTypes.NUMBER },
    flowDefinitionsQueryChunkSize: { refType: BuiltinTypes.NUMBER },
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
    addNamespacePrefixToFullName: { refType: BuiltinTypes.BOOLEAN },
    warningSettings: { refType: warningSettingsType },
    additionalImportantValues: {
      // Exported type is downcast to TypeElement
      refType: new ListType(importantValueType),
    },
    limits: { refType: limitsType },
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
              { metadataType: 'SiteDotCom' },
              {
                metadataType: 'EmailTemplate',
                name: 'Marketo_?Email_?Templates/.*',
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
              {
                metadataType: 'EclairGeoData',
              },
              {
                metadataType:
                  'OmniUiCard|OmniDataTransform|OmniIntegrationProcedure|OmniInteractionAccessConfig|OmniInteractionConfig|OmniScript',
              },
              {
                metadataType: 'DiscoveryAIModel',
              },
              {
                metadataType: 'Translations',
              },
              {
                metadataType: 'ManagedEventSubscription',
              },
            ],
          },
          [SHOULD_FETCH_ALL_CUSTOM_SETTINGS]: false,
          [MAX_INSTANCES_PER_TYPE]: constants.DEFAULT_MAX_INSTANCES_PER_TYPE,
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
    [CLIENT_CONFIG]: {
      refType: clientConfigType,
    },
    [DEPLOY_CONFIG]: {
      refType: definitions.createUserDeployConfigType(constants.SALESFORCE, changeValidatorConfigType),
    },
    [CUSTOM_REFS_CONFIG]: {
      refType: customReferencesSettingsType,
    },
    [FIX_ELEMENTS_CONFIG]: {
      refType: fixElementsSettingsType,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})
export type MetadataQuery<T = MetadataInstance> = {
  isTypeMatch: (type: string) => boolean
  isInstanceIncluded: (instance: T) => boolean
  isInstanceMatch: (instance: T) => boolean
  isTargetedFetch: () => boolean
  isFetchWithChangesDetection: () => boolean
  isPartialFetch: () => boolean
  getFolderPathsByName: (folderType: string) => Record<string, string>
  logData: () => void
}

type TypeFetchCategory = 'Always' | 'IfReferenced' | 'Never'

export type DataManagement = {
  shouldFetchObjectType: (objectType: ObjectType) => Promise<TypeFetchCategory>
  brokenReferenceBehaviorForTargetType: (typeName: string | undefined) => OutgoingReferenceBehavior
  isReferenceAllowed: (name: string) => boolean
  getObjectIdsFields: (name: string) => string[]
  getObjectAliasFields: (name: string) => types.NonEmptyArray<string>
  showReadOnlyValues?: boolean
  managedBySaltoFieldForType: (objType: ObjectType) => string | undefined
  omittedFieldsForType: (name: string) => string[]
  regenerateSaltoIds: boolean
}

export type FetchProfile = {
  readonly metadataQuery: MetadataQuery
  readonly dataManagement?: DataManagement
  readonly isFeatureEnabled: (name: keyof OptionalFeatures) => boolean
  readonly isCustomReferencesHandlerEnabled: (name: CustomReferencesHandlers) => boolean
  readonly shouldFetchAllCustomSettings: () => boolean
  readonly maxInstancesPerType: number
  readonly preferActiveFlowVersions: boolean
  readonly addNamespacePrefixToFullName: boolean
  isWarningEnabled: (name: keyof WarningSettings) => boolean
  readonly maxItemsInRetrieveRequest: number
  readonly importantValues: ImportantValues
  readonly limits?: FetchLimits
}

export type TypeWithNestedInstances = (typeof constants.TYPES_WITH_NESTED_INSTANCES)[number]
export type TypeWithNestedInstancesPerParent = (typeof constants.TYPES_WITH_NESTED_INSTANCES_PER_PARENT)[number]
export type LastChangeDateOfTypesWithNestedInstances = {
  [key in TypeWithNestedInstancesPerParent]: Record<string, string>
} & {
  [key in TypeWithNestedInstances]: string | undefined
}

export type ProfileRelatedMetadataType = (typeof constants.PROFILE_RELATED_METADATA_TYPES)[number]

export type WeakReferencesHandler = ComponentsWeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
  config: SalesforceConfig
}>

export enum ProfileSection {
  ApplicationVisibilities = 'applicationVisibilities',
  CategoryGroupVisibilities = 'categoryGroupVisibilities',
  ClassAccesses = 'classAccesses',
  CustomMetadataTypeAccesses = 'customMetadataTypeAccesses',
  CustomPermissions = 'customPermissions',
  CustomSettingAccesses = 'customSettingAccesses',
  ExternalDataSourceAccesses = 'externalDataSourceAccesses',
  FieldPermissions = 'fieldPermissions',
  FlowAccesses = 'flowAccesses',
  LayoutAssignments = 'layoutAssignments',
  ObjectPermissions = 'objectPermissions',
  PageAccesses = 'pageAccesses',
  RecordTypeVisibilities = 'recordTypeVisibilities',
  TabVisibilities = 'tabVisibilities',
  UserPermissions = 'userPermissions',
}
