/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { types as lowerdashTypes } from '@salto-io/lowerdash'
import { ElemID, ListType, BuiltinTypes, CORE_ANNOTATIONS, createRestriction, MapType, Values } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { config as configUtils } from '@salto-io/adapter-components'
import { BIN, CURRENCY, CUSTOM_RECORD_TYPE, DATASET, EXCHANGE_RATE, INACTIVE_FIELDS, NETSUITE, PERMISSIONS, SAVED_SEARCH, WORKBOOK } from '../constants'
import { netsuiteSupportedTypes } from '../types'
import { ITEM_TYPE_TO_SEARCH_STRING } from '../data_elements/types'
import { ALL_TYPES_REGEX, DEFAULT_AXIOS_TIMEOUT_IN_MINUTES, DEFAULT_COMMAND_TIMEOUT_IN_MINUTES, DEFAULT_CONCURRENCY, DEFAULT_FETCH_ALL_TYPES_AT_ONCE, DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB, DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, FILE_TYPES_TO_EXCLUDE_REGEX } from './constants'

export type InstanceLimiterFunc = (type: string, instanceCount: number) => boolean
export interface ObjectID {
  type: string
  instanceId: string
}

export type NetsuiteTypesQueryParams = Record<string, string[]>
export type NetsuiteFilePathsQueryParams = string[]

export type NetsuiteQueryParameters = {
  types?: NetsuiteTypesQueryParams
  filePaths?: NetsuiteFilePathsQueryParams
  customRecords?: NetsuiteTypesQueryParams
}

export const QUERY_PARAMS: lowerdashTypes.TypeKeysEnum<NetsuiteQueryParameters> = {
  types: 'types',
  filePaths: 'filePaths',
  customRecords: 'customRecords',
}

export type IdsQuery = {
  name: string
  ids?: string[]
}

export type CriteriaQuery = {
  name: string
  criteria: Values
}

export type FetchTypeQueryParams = IdsQuery | CriteriaQuery

export type QueryParams = {
  types: FetchTypeQueryParams[]
  fileCabinet: string[]
  customRecords?: FetchTypeQueryParams[]
}

export type LockedElementsConfig = {
  fetch: {
    lockedElementsToExclude?: QueryParams
  }
}

export type FieldToOmitParams = {
  type: string
  subtype?: string
  fields: string[]
}

export type FetchParams = {
  include: QueryParams
  exclude: QueryParams
  authorInformation?: {
    enable?: boolean
  }
  strictInstanceStructure?: boolean
  fieldsToOmit?: FieldToOmitParams[]
  addAlias?: boolean
  addBundles?: boolean
  addImportantValues?: boolean
} & LockedElementsConfig['fetch']

export const FETCH_PARAMS: lowerdashTypes.TypeKeysEnum<FetchParams> = {
  include: 'include',
  exclude: 'exclude',
  lockedElementsToExclude: 'lockedElementsToExclude',
  authorInformation: 'authorInformation',
  strictInstanceStructure: 'strictInstanceStructure',
  fieldsToOmit: 'fieldsToOmit',
  addAlias: 'addAlias',
  addBundles: 'addBundles',
  addImportantValues: 'addImportantValues',
}

export type AdditionalSdfDeployDependencies = {
  features: string[]
  objects: string[]
  files: string[]
}

export type AdditionalDependencies = {
  include: AdditionalSdfDeployDependencies
  exclude: AdditionalSdfDeployDependencies
}

type UserDeployConfig = configUtils.UserDeployConfig

export type DeployParams = UserDeployConfig & {
  warnOnStaleWorkspaceData?: boolean
  validate?: boolean
  deployReferencedElements?: boolean
  additionalDependencies?: {
    include?: Partial<AdditionalSdfDeployDependencies>
    exclude?: Partial<AdditionalSdfDeployDependencies>
  }
  fieldsToOmit?: FieldToOmitParams[]
}

export const DEPLOY_PARAMS: lowerdashTypes.TypeKeysEnum<DeployParams> = {
  warnOnStaleWorkspaceData: 'warnOnStaleWorkspaceData',
  validate: 'validate',
  deployReferencedElements: 'deployReferencedElements',
  additionalDependencies: 'additionalDependencies',
  changeValidators: 'changeValidators',
  fieldsToOmit: 'fieldsToOmit',
}

export type MaxInstancesPerType = {
  name: string
  limit: number
}

type SdfClientConfig = {
  fetchAllTypesAtOnce?: boolean
  maxItemsInImportObjectsRequest?: number
  fetchTypeTimeoutInMinutes?: number
  sdfConcurrencyLimit?: number
  installedSuiteApps?: string[]
}

export type ClientConfig = SdfClientConfig & {
  maxInstancesPerType?: MaxInstancesPerType[]
  maxFileCabinetSizeInGB?: number
}

export const CLIENT_CONFIG: lowerdashTypes.TypeKeysEnum<ClientConfig> = {
  fetchAllTypesAtOnce: 'fetchAllTypesAtOnce',
  maxItemsInImportObjectsRequest: 'maxItemsInImportObjectsRequest',
  fetchTypeTimeoutInMinutes: 'fetchTypeTimeoutInMinutes',
  sdfConcurrencyLimit: 'sdfConcurrencyLimit',
  installedSuiteApps: 'installedSuiteApps',
  maxInstancesPerType: 'maxInstancesPerType',
  maxFileCabinetSizeInGB: 'maxFileCabinetSizeInGB',
}

export type SuiteAppClientConfig = {
  suiteAppConcurrencyLimit?: number
  httpTimeoutLimitInMinutes?: number
}

export type NetsuiteConfig = {
  typesToSkip?: string[]
  filePathRegexSkipList?: string[]
  deploy?: DeployParams
  concurrencyLimit?: number
  client?: ClientConfig
  suiteAppClient?: SuiteAppClientConfig
  fetch: FetchParams
  fetchTarget?: NetsuiteQueryParameters
  skipList?: NetsuiteQueryParameters
  useChangesDetection?: boolean // TODO remove this from config SALTO-3676
  withPartialDeletion?: boolean
  deployReferencedElements?: boolean
}

export const CONFIG: lowerdashTypes.TypeKeysEnum<NetsuiteConfig> = {
  typesToSkip: 'typesToSkip',
  filePathRegexSkipList: 'filePathRegexSkipList',
  deploy: 'deploy',
  concurrencyLimit: 'concurrencyLimit',
  client: 'client',
  suiteAppClient: 'suiteAppClient',
  fetch: 'fetch',
  fetchTarget: 'fetchTarget',
  skipList: 'skipList',
  useChangesDetection: 'useChangesDetection',
  withPartialDeletion: 'withPartialDeletion',
  deployReferencedElements: 'deployReferencedElements',
}

export type NetsuiteValidatorName = (
  | 'exchangeRate'
  | 'currencyUndeployableFields'
  | 'workflowAccountSpecificValues'
  | 'accountSpecificValues'
  | 'dataAccountSpecificValues'
  | 'removeSdfElements'
  | 'instanceChanges'
  | 'reportTypesMove'
  | 'immutableChanges'
  | 'inactive'
  | 'removeListItem'
  | 'file'
  | 'uniqueFields'
  | 'subInstances'
  | 'standardTypesInvalidValues'
  | 'mappedListsIndexes'
  | 'notYetSupportedValues'
  | 'configChanges'
  | 'suiteAppConfigElements'
  | 'undeployableConfigFeatures'
  | 'extraReferenceDependencies'
  | 'rolePermission'
  | 'translationCollectionReferences'
  | 'omitFields'
  | 'unreferencedFileAddition'
  | 'unreferencedDatasets'
  | 'analyticsSilentFailure'
)

export type NonSuiteAppValidatorName = (
  | 'removeFileCabinet'
  | 'removeStandardTypes'
)

export type OnlySuiteAppValidatorName = (
  | 'fileCabinetInternalIds'
)

type ChangeValidatorConfig = Record<
  NetsuiteValidatorName | NonSuiteAppValidatorName | OnlySuiteAppValidatorName,
  boolean | undefined
>

const maxInstancesPerConfigType = createMatchingObjectType<MaxInstancesPerType>({
  elemID: new ElemID(NETSUITE, 'maxType'),
  fields: {
    name: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    limit: {
      refType: BuiltinTypes.NUMBER,
      annotations: { _required: true },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const clientConfigType = createMatchingObjectType<ClientConfig>({
  elemID: new ElemID(NETSUITE, 'clientConfig'),
  fields: {
    fetchAllTypesAtOnce: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_ALL_TYPES_AT_ONCE,
      },
    },
    fetchTypeTimeoutInMinutes: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        // We set DEFAULT_COMMAND_TIMEOUT_IN_MINUTES to FETCH_TYPE_TIMEOUT_IN_MINUTES since we did
        // not want to have a disrupting change to existing WSs with renaming this annotation.
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_COMMAND_TIMEOUT_IN_MINUTES,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    maxItemsInImportObjectsRequest: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    sdfConcurrencyLimit: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_CONCURRENCY,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
    installedSuiteApps: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    maxInstancesPerType: {
      refType: new ListType(maxInstancesPerConfigType),
    },
    maxFileCabinetSizeInGB: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB,
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const suiteAppClientConfigType = createMatchingObjectType<SuiteAppClientConfig>({
  elemID: new ElemID(NETSUITE, 'suiteAppClientConfig'),
  fields: {
    suiteAppConcurrencyLimit: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_CONCURRENCY,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
    httpTimeoutLimitInMinutes: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_AXIOS_TIMEOUT_IN_MINUTES,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const queryConfigType = createMatchingObjectType<NetsuiteQueryParameters>({
  elemID: new ElemID(NETSUITE, 'queryConfig'),
  fields: {
    types: {
      refType: new MapType(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {},
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: netsuiteSupportedTypes, enforce_value: false }),
      },
    },
    filePaths: {
      refType: (new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    },
    customRecords: {
      refType: new MapType(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {},
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customrecord[0-9a-z_]+$', enforce_value: false }),
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fetchTypeQueryParamsConfigType = createMatchingObjectType<
  Pick<FetchTypeQueryParams, 'name'> & Partial<FetchTypeQueryParams>
>({
  elemID: new ElemID(NETSUITE, 'fetchTypeQueryParams'),
  fields: {
    name: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    ids: { refType: new ListType(BuiltinTypes.STRING) },
    criteria: { refType: new MapType(BuiltinTypes.UNKNOWN) },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const queryParamsConfigType = createMatchingObjectType<QueryParams>({
  elemID: new ElemID(NETSUITE, 'queryParams'),
  fields: {
    types: {
      refType: new ListType(fetchTypeQueryParamsConfigType),
      annotations: { _required: true },
    },
    fileCabinet: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { _required: true },
    },
    customRecords: {
      refType: new ListType(fetchTypeQueryParamsConfigType),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const fetchDefault: FetchParams = {
  include: {
    types: [{
      name: ALL_TYPES_REGEX,
    }],
    fileCabinet: [
      '^/SuiteScripts.*',
      '^/Templates.*',
    ],
  },
  fieldsToOmit: [
    {
      type: CURRENCY,
      fields: [
        EXCHANGE_RATE,
      ],
    },
    {
      type: CUSTOM_RECORD_TYPE,
      fields: [
        PERMISSIONS,
      ],
    },
  ],
  exclude: {
    types: [
      // Has a definition field which is a long XML and it contains 'translationScriptId'
      // value that changes every fetch
      { name: WORKBOOK },
      // Has a definition field which is a long XML and it contains 'translationScriptId'
      // value that changes every fetch
      { name: DATASET },
      { name: 'customer' },
      { name: 'accountingPeriod' },
      { name: 'employee' },
      { name: 'job' },
      { name: 'manufacturingCostTemplate' },
      { name: 'partner' },
      { name: 'solution' },
      { name: 'giftCertificateItem' }, // requires special features enabled in the account. O.W fetch will fail
      { name: 'downloadItem' }, // requires special features enabled in the account. O.W fetch will fail
      { name: 'account' },
      { name: BIN },
      {
        name: Object.keys(ITEM_TYPE_TO_SEARCH_STRING)
          .filter(itemTypeName => !['giftCertificateItem', 'downloadItem'].includes(itemTypeName))
          .join('|'),
      }, // may be a lot of data that takes a lot of time to fetch
      ...Object.values(INACTIVE_FIELDS)
        .map((fieldName): CriteriaQuery => ({
          name: ALL_TYPES_REGEX,
          criteria: {
            [fieldName]: true,
          },
        })),
      {
        name: SAVED_SEARCH,
        criteria: {
          FLAG_PUBLIC: false,
        },
      },
    ],
    fileCabinet: [
      '^/Templates/Letter Templates/Mail Merge Folder.*',
      FILE_TYPES_TO_EXCLUDE_REGEX,
      FILE_TYPES_TO_EXCLUDE_REGEX.toUpperCase(),
    ],
  },
}

const authorInfoConfig = createMatchingObjectType<FetchParams['authorInformation']>({
  elemID: new ElemID(NETSUITE, 'authorInfo'),
  fields: {
    enable: {
      refType: BuiltinTypes.BOOLEAN,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fieldsToOmitConfig = createMatchingObjectType<FieldToOmitParams>({
  elemID: new ElemID(NETSUITE, 'fieldsToOmitConfig'),
  fields: {
    type: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    subtype: {
      refType: BuiltinTypes.STRING,
    },
    fields: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { _required: true },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fetchConfigType = createMatchingObjectType<FetchParams>({
  elemID: new ElemID(NETSUITE, 'fetchConfig'),
  fields: {
    include: {
      refType: queryParamsConfigType,
      annotations: {
        _required: true,
      },
    },
    exclude: {
      refType: queryParamsConfigType,
      annotations: {
        _required: true,
      },
    },
    lockedElementsToExclude: { refType: queryParamsConfigType },
    authorInformation: { refType: authorInfoConfig },
    strictInstanceStructure: { refType: BuiltinTypes.BOOLEAN },
    fieldsToOmit: { refType: new ListType(fieldsToOmitConfig) },
    addAlias: { refType: BuiltinTypes.BOOLEAN },
    addBundles: { refType: BuiltinTypes.BOOLEAN },
    addImportantValues: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const additionalDependenciesInnerType = createMatchingObjectType<
Partial<AdditionalSdfDeployDependencies>
>({
  elemID: new ElemID(NETSUITE, 'additionalDependenciesInner'),
  fields: {
    features: { refType: new ListType(BuiltinTypes.STRING) },
    objects: { refType: new ListType(BuiltinTypes.STRING) },
    files: { refType: new ListType(BuiltinTypes.STRING) },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const additionalDependenciesType = createMatchingObjectType<
DeployParams['additionalDependencies']
>({
  elemID: new ElemID(NETSUITE, 'additionalDependencies'),
  fields: {
    include: { refType: additionalDependenciesInnerType },
    exclude: { refType: additionalDependenciesInnerType },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const changeValidatorConfigType = createMatchingObjectType<ChangeValidatorConfig>({
  elemID: new ElemID(NETSUITE, 'changeValidatorConfig'),
  fields: {
    exchangeRate: { refType: BuiltinTypes.BOOLEAN },
    currencyUndeployableFields: { refType: BuiltinTypes.BOOLEAN },
    workflowAccountSpecificValues: { refType: BuiltinTypes.BOOLEAN },
    accountSpecificValues: { refType: BuiltinTypes.BOOLEAN },
    dataAccountSpecificValues: { refType: BuiltinTypes.BOOLEAN },
    removeSdfElements: { refType: BuiltinTypes.BOOLEAN },
    instanceChanges: { refType: BuiltinTypes.BOOLEAN },
    reportTypesMove: { refType: BuiltinTypes.BOOLEAN },
    immutableChanges: { refType: BuiltinTypes.BOOLEAN },
    inactive: { refType: BuiltinTypes.BOOLEAN },
    removeListItem: { refType: BuiltinTypes.BOOLEAN },
    file: { refType: BuiltinTypes.BOOLEAN },
    uniqueFields: { refType: BuiltinTypes.BOOLEAN },
    subInstances: { refType: BuiltinTypes.BOOLEAN },
    standardTypesInvalidValues: { refType: BuiltinTypes.BOOLEAN },
    mappedListsIndexes: { refType: BuiltinTypes.BOOLEAN },
    notYetSupportedValues: { refType: BuiltinTypes.BOOLEAN },
    configChanges: { refType: BuiltinTypes.BOOLEAN },
    suiteAppConfigElements: { refType: BuiltinTypes.BOOLEAN },
    undeployableConfigFeatures: { refType: BuiltinTypes.BOOLEAN },
    extraReferenceDependencies: { refType: BuiltinTypes.BOOLEAN },
    rolePermission: { refType: BuiltinTypes.BOOLEAN },
    removeFileCabinet: { refType: BuiltinTypes.BOOLEAN },
    removeStandardTypes: { refType: BuiltinTypes.BOOLEAN },
    fileCabinetInternalIds: { refType: BuiltinTypes.BOOLEAN },
    translationCollectionReferences: { refType: BuiltinTypes.BOOLEAN },
    omitFields: { refType: BuiltinTypes.BOOLEAN },
    unreferencedFileAddition: { refType: BuiltinTypes.BOOLEAN },
    unreferencedDatasets: { refType: BuiltinTypes.BOOLEAN },
    analyticsSilentFailure: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const baseDeployConfigType = createMatchingObjectType<Omit<DeployParams, keyof UserDeployConfig>>({
  elemID: new ElemID(NETSUITE, 'deploy_config'),
  fields: {
    warnOnStaleWorkspaceData: { refType: BuiltinTypes.BOOLEAN },
    validate: { refType: BuiltinTypes.BOOLEAN },
    deployReferencedElements: { refType: BuiltinTypes.BOOLEAN },
    additionalDependencies: { refType: additionalDependenciesType },
    fieldsToOmit: { refType: new ListType(fieldsToOmitConfig) },
  },
})

const deployConfigType = configUtils.createUserDeployConfigType(
  NETSUITE,
  changeValidatorConfigType,
  baseDeployConfigType.fields,
)

export const configType = createMatchingObjectType<NetsuiteConfig>({
  elemID: new ElemID(NETSUITE),
  fields: {
    fetch: {
      refType: fetchConfigType,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: fetchDefault,
        _required: true,
      },
    },
    filePathRegexSkipList: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    deploy: {
      refType: deployConfigType,
    },
    concurrencyLimit: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
    client: {
      refType: clientConfigType,
    },
    suiteAppClient: {
      refType: suiteAppClientConfigType,
    },
    fetchTarget: {
      refType: queryConfigType,
    },
    useChangesDetection: {
      refType: BuiltinTypes.BOOLEAN,
    },
    withPartialDeletion: {
      refType: BuiltinTypes.BOOLEAN,
    },
    typesToSkip: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    skipList: {
      refType: queryConfigType,
    },
    deployReferencedElements: {
      refType: BuiltinTypes.BOOLEAN,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})
