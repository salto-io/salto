/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { strings, types as lowerdashTypes, values } from '@salto-io/lowerdash'
import {
  InstanceElement, ElemID, ListType, BuiltinTypes, CORE_ANNOTATIONS,
  createRestriction, MapType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import {
  CURRENCY, CUSTOM_RECORD_TYPE, DATASET, EXCHANGE_RATE, NETSUITE, PERMISSIONS, WORKBOOK,
} from './constants'
import { NetsuiteQueryParameters, FetchParams, convertToQueryParams, QueryParams, FetchTypeQueryParams, FieldToOmitParams, validateArrayOfStrings, validatePlainObject, validateFetchParameters, FETCH_PARAMS, validateFieldsToOmitConfig } from './query'
import { ITEM_TYPE_TO_SEARCH_STRING, TYPES_TO_INTERNAL_ID } from './data_elements/types'
import { FailedFiles, FailedTypes } from './client/types'
import { netsuiteSupportedTypes } from './types'

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_COMMAND_TIMEOUT_IN_MINUTES = 4
export const DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 40
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false
export const DEFAULT_WARN_STALE_DATA = false
export const DEFAULT_VALIDATE = true

const REQUIRED_FEATURE_SUFFIX = ':required'
export const isRequiredFeature = (featureName: string): boolean =>
  featureName.toLowerCase().endsWith(REQUIRED_FEATURE_SUFFIX)
export const removeRequiredFeatureSuffix = (featureName: string): string =>
  featureName.slice(0, featureName.length - REQUIRED_FEATURE_SUFFIX.length)

type AdditionalSdfDeployDependencies = {
  features: string[]
  objects: string[]
}

export type AdditionalDependencies = {
  include: AdditionalSdfDeployDependencies
  exclude: AdditionalSdfDeployDependencies
}

export type DeployParams = {
  warnOnStaleWorkspaceData?: boolean
  validate?: boolean
  deployReferencedElements?: boolean
  additionalDependencies?: {
    include?: Partial<AdditionalSdfDeployDependencies>
    exclude?: Partial<AdditionalSdfDeployDependencies>
  }
}

export const DEPLOY_PARAMS: lowerdashTypes.TypeKeysEnum<DeployParams> = {
  warnOnStaleWorkspaceData: 'warnOnStaleWorkspaceData',
  validate: 'validate',
  deployReferencedElements: 'deployReferencedElements',
  additionalDependencies: 'additionalDependencies',
}

export type SdfClientConfig = {
  fetchAllTypesAtOnce?: boolean
  maxItemsInImportObjectsRequest?: number
  fetchTypeTimeoutInMinutes?: number
  sdfConcurrencyLimit?: number
  installedSuiteApps?: string[]
}

export const CLIENT_CONFIG: lowerdashTypes.TypeKeysEnum<SdfClientConfig> = {
  fetchAllTypesAtOnce: 'fetchAllTypesAtOnce',
  maxItemsInImportObjectsRequest: 'maxItemsInImportObjectsRequest',
  fetchTypeTimeoutInMinutes: 'fetchTypeTimeoutInMinutes',
  sdfConcurrencyLimit: 'sdfConcurrencyLimit',
  installedSuiteApps: 'installedSuiteApps',
}

export type SuiteAppClientConfig = {
  suiteAppConcurrencyLimit?: number
}

export type NetsuiteConfig = {
  typesToSkip?: string[]
  filePathRegexSkipList?: string[]
  deploy?: DeployParams
  concurrencyLimit?: number
  client?: SdfClientConfig
  suiteAppClient?: SuiteAppClientConfig
  fetch?: FetchParams
  fetchTarget?: NetsuiteQueryParameters
  skipList?: NetsuiteQueryParameters
  useChangesDetection?: boolean // TODO remove this from config SALTO-3676
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
  deployReferencedElements: 'deployReferencedElements',
}

const clientConfigType = createMatchingObjectType<SdfClientConfig>({
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

const fetchTypeQueryParamsConfigType = createMatchingObjectType<FetchTypeQueryParams>({
  elemID: new ElemID(NETSUITE, 'fetchTypeQueryParams'),
  fields: {
    name: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    ids: { refType: new ListType(BuiltinTypes.STRING) },
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
      name: '.*',
    }],
    fileCabinet: [
      '^/SuiteScripts.*',
      '^/Templates.*',
    ],
    // SALTO-2198 should be fetched by default after some run time
    // customRecords: [{
    //   name: '.*',
    // }],
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
      {
        name: Object.keys(ITEM_TYPE_TO_SEARCH_STRING)
          .filter(itemTypeName => !['giftCertificateItem', 'downloadItem'].includes(itemTypeName))
          .join('|'),
      }, // may be a lot of data that takes a lot of time to fetch
    ],
    fileCabinet: [
      '^/Templates/Letter Templates/Mail Merge Folder.*',
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
    include: { refType: queryParamsConfigType },
    exclude: { refType: queryParamsConfigType },
    lockedElementsToExclude: { refType: queryParamsConfigType },
    authorInformation: { refType: authorInfoConfig },
    strictInstanceStructure: { refType: BuiltinTypes.BOOLEAN },
    fieldsToOmit: { refType: new ListType(fieldsToOmitConfig) },
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

const deployConfigType = createMatchingObjectType<DeployParams>({
  elemID: new ElemID(NETSUITE, 'deployConfig'),
  fields: {
    warnOnStaleWorkspaceData: { refType: BuiltinTypes.BOOLEAN },
    validate: { refType: BuiltinTypes.BOOLEAN },
    deployReferencedElements: { refType: BuiltinTypes.BOOLEAN },
    additionalDependencies: { refType: additionalDependenciesType },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const additionalDependenciesConfigPath: string[] = [
  CONFIG.deploy,
  DEPLOY_PARAMS.additionalDependencies,
]

function validateAdditionalSdfDeployDependencies(
  input: Partial<Record<keyof AdditionalSdfDeployDependencies, unknown>>,
  configName: string
): asserts input is Partial<AdditionalSdfDeployDependencies> {
  const { features, objects } = input
  if (features !== undefined) {
    validateArrayOfStrings(features, additionalDependenciesConfigPath.concat(configName, 'features'))
  }
  if (objects !== undefined) {
    validateArrayOfStrings(objects, additionalDependenciesConfigPath.concat(configName, 'objects'))
  }
}

const validateAdditionalDependencies = (
  { include, exclude }: Partial<Record<keyof AdditionalDependencies, unknown>>
): void => {
  if (include !== undefined) {
    validatePlainObject(include, additionalDependenciesConfigPath.concat('include'))
    validateAdditionalSdfDeployDependencies(include, 'include')
  }
  if (exclude !== undefined) {
    validatePlainObject(exclude, additionalDependenciesConfigPath.concat('exclude'))
    validateAdditionalSdfDeployDependencies(exclude, 'exclude')
  }
  if (include?.features && exclude?.features) {
    const conflictedFeatures = _.intersection(
      include.features.map(featureName => (
        isRequiredFeature(featureName)
          ? removeRequiredFeatureSuffix(featureName)
          : featureName
      )),
      exclude.features
    )
    if (conflictedFeatures.length > 0) {
      throw new Error(`Additional features cannot be both included and excluded. The following features are conflicted: ${conflictedFeatures.join(', ')}`)
    }
  }
  if (include?.objects && exclude?.objects) {
    const conflictedObjects = _.intersection(include.objects, exclude.objects)
    if (conflictedObjects.length > 0) {
      throw new Error(`Additional objects cannot be both included and excluded. The following objects are conflicted: ${conflictedObjects.join(', ')}`)
    }
  }
}

export const validateFetchConfig = ({
  include, exclude, fieldsToOmit,
}: Record<keyof FetchParams, unknown>): void => {
  if (include !== undefined) {
    validatePlainObject(include, [CONFIG.fetch, FETCH_PARAMS.include])
    validateFetchParameters(include)
  }
  if (exclude !== undefined) {
    validatePlainObject(exclude, [CONFIG.fetch, FETCH_PARAMS.exclude])
    validateFetchParameters(exclude)
  }
  if (fieldsToOmit !== undefined) {
    validateFieldsToOmitConfig(fieldsToOmit)
  }
}

export const validateDeployParams = (
  {
    deployReferencedElements,
    warnOnStaleWorkspaceData,
    validate,
    additionalDependencies,
  }: Record<keyof DeployParams, unknown>
): void => {
  if (deployReferencedElements !== undefined
    && typeof deployReferencedElements !== 'boolean') {
    throw new Error(`Expected "deployReferencedElements" to be a boolean or to be undefined, but received:\n ${deployReferencedElements}`)
  }
  if (warnOnStaleWorkspaceData !== undefined
    && typeof warnOnStaleWorkspaceData !== 'boolean') {
    throw new Error(`Expected "warnOnStaleWorkspaceData" to be a boolean or to be undefined, but received:\n ${warnOnStaleWorkspaceData}`)
  }
  if (validate !== undefined
    && typeof validate !== 'boolean') {
    throw new Error(`Expected "validate" to be a boolean or to be undefined, but received:\n ${validate}`)
  }
  if (additionalDependencies !== undefined) {
    validatePlainObject(additionalDependencies, additionalDependenciesConfigPath)
    validateAdditionalDependencies(additionalDependencies)
  }
}

export const configType = createMatchingObjectType<NetsuiteConfig>({
  elemID: new ElemID(NETSUITE),
  fields: {
    fetch: {
      refType: fetchConfigType,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: fetchDefault,
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

export const STOP_MANAGING_ITEMS_MSG = 'Salto failed to fetch some items from NetSuite.'
  + ' In order to complete the fetch operation, Salto needs to stop managing these items by modifying the configuration.'

export const UPDATE_FETCH_CONFIG_FORMAT = 'The configuration options "typeToSkip", "filePathRegexSkipList" and "skipList" are deprecated.'
  + ' To skip items in fetch, please use the "fetch.exclude" option.'
  + ' The following configuration will update the deprecated fields to "fetch.exclude" field.'

export const UPDATE_SUITEAPP_TYPES_CONFIG_FORMAT = 'Some type names have been changed. The following changes will update the type names in the adapter configuration.'

export const UPDATE_DEPLOY_CONFIG = 'All deploy\'s configuration flags are under "deploy" configuration.'
+ ' you may leave "deploy" section as undefined to set all deploy\'s configuration flags to their default value.'

const createExclude = ({
  filePaths: failedPaths = [],
  types: failedTypes = {},
}: Pick<NetsuiteQueryParameters, 'types' | 'filePaths'>): QueryParams =>
  ({
    fileCabinet: failedPaths.map(_.escapeRegExp),
    types: Object.entries(failedTypes).map(([name, ids]) => ({ name, ids })),
  })

const toConfigSuggestions = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: FailedFiles,
  failedTypes: FailedTypes
): NetsuiteConfig => {
  const config: NetsuiteConfig = {}

  if (!_.isEmpty(failedFilePaths.otherError) || !_.isEmpty(failedTypes.unexpectedError)) {
    config.fetch = {
      ...config.fetch,
      exclude: createExclude({
        filePaths: failedFilePaths.otherError,
        types: failedTypes.unexpectedError,
      }),
    }
  }
  if (!_.isEmpty(failedFilePaths.lockedError) || !_.isEmpty(failedTypes.lockedError)) {
    config.fetch = {
      ...config.fetch,
      lockedElementsToExclude: createExclude({
        filePaths: failedFilePaths.lockedError,
        types: failedTypes.lockedError,
      }),
    }
  }
  if (failedToFetchAllAtOnce) {
    config.client = {
      ...config.client,
      fetchAllTypesAtOnce: false,
    }
  }
  return config
}


const convertDeprecatedFilePathRegex = (filePathRegex: string): string => {
  let newPathRegex = filePathRegex
  newPathRegex = newPathRegex.startsWith('^')
    ? newPathRegex.substring(1)
    : `.*${newPathRegex}`

  newPathRegex = newPathRegex.endsWith('$')
    ? newPathRegex.substring(0, newPathRegex.length - 1)
    : `${newPathRegex}.*`

  return newPathRegex
}

// uniting first's and second's types. without duplications
const combineFetchTypeQueryParams = (
  first: FetchTypeQueryParams[],
  second: FetchTypeQueryParams[]
): FetchTypeQueryParams[] => _(first)
  .concat(second)
  .groupBy(type => type.name)
  .map((types, name) => ({
    name,
    ...types.some(type => type.ids === undefined)
      ? {}
      : { ids: _.uniq(types.flatMap(type => type.ids ?? [])) },
  }))
  .value()

export const combineQueryParams = (
  first: QueryParams | undefined,
  second: QueryParams | undefined,
): QueryParams => {
  if (first === undefined || second === undefined) {
    return first ?? second ?? { types: [], fileCabinet: [] }
  }

  // case where both are defined
  const newFileCabinet = _(first.fileCabinet).concat(second.fileCabinet).uniq().value()
  const newTypes = combineFetchTypeQueryParams(first.types, second.types)
  const newCustomRecords = first.customRecords || second.customRecords ? {
    customRecords: combineFetchTypeQueryParams(
      first.customRecords ?? [],
      second.customRecords ?? []
    ),
  } : {}

  return {
    fileCabinet: newFileCabinet,
    types: newTypes,
    ...newCustomRecords,
  }
}

const emptyQueryParams = (): QueryParams => combineQueryParams(undefined, undefined)

const updateConfigFromFailures = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: FailedFiles,
  failedTypes: FailedTypes,
  config: NetsuiteConfig,
): boolean => {
  const suggestions = toConfigSuggestions(
    failedToFetchAllAtOnce, failedFilePaths, failedTypes
  )
  if (_.isEmpty(suggestions)) {
    return false
  }

  const {
    fetch: currentFetchConfig,
    client: currentClientConfig,
  } = config
  const {
    fetch: suggestedFetchConfig,
    client: suggestedClientConfig,
  } = suggestions

  if (suggestedClientConfig?.fetchAllTypesAtOnce !== undefined) {
    config.client = {
      ...currentClientConfig,
      fetchAllTypesAtOnce: suggestedClientConfig.fetchAllTypesAtOnce,
    }
  }

  const updatedFetchConfig = {
    ...currentFetchConfig,
    exclude: combineQueryParams(currentFetchConfig?.exclude, suggestedFetchConfig?.exclude),
  }

  const newLockedElementToExclude = combineQueryParams(
    currentFetchConfig?.lockedElementsToExclude,
    suggestedFetchConfig?.lockedElementsToExclude
  )

  if (!_.isEqual(newLockedElementToExclude, emptyQueryParams())) {
    updatedFetchConfig.lockedElementsToExclude = newLockedElementToExclude
  }

  config.fetch = updatedFetchConfig
  return true
}

const updateConfigSkipListFormat = (config: NetsuiteConfig): void => {
  const { skipList = {}, typesToSkip, filePathRegexSkipList } = config
  if (typesToSkip === undefined && filePathRegexSkipList === undefined) {
    return
  }
  if (typesToSkip !== undefined) {
    skipList.types = {
      ...skipList.types,
      ...Object.fromEntries(typesToSkip.map(type => [type, ['.*']])),
    }
  }
  if (filePathRegexSkipList !== undefined) {
    skipList.filePaths = (skipList.filePaths ?? [])
      .concat(filePathRegexSkipList.map(convertDeprecatedFilePathRegex))
  }
  config.skipList = skipList
  delete config.typesToSkip
  delete config.filePathRegexSkipList
}

const updateConfigFetchFormat = (config: NetsuiteConfig): boolean => {
  const { skipList, fetch } = config
  if (skipList === undefined) {
    return false
  }

  const typesToExclude = convertToQueryParams(skipList)
  delete config.skipList

  config.fetch = fetch !== undefined ? {
    include: fetch.include,
    exclude: combineQueryParams(fetch.exclude, typesToExclude),
  } : {
    include: fetchDefault.include,
    exclude: combineQueryParams(typesToExclude, fetchDefault.exclude),
  }
  return true
}

const updateSuiteAppTypes = (config: NetsuiteConfig): boolean => {
  let didUpdate = false
  config.fetch?.exclude?.types.forEach(excludeItem => {
    const fixedName = strings.lowerCaseFirstLetter(excludeItem.name)
    if (excludeItem.name !== fixedName && fixedName in TYPES_TO_INTERNAL_ID) {
      excludeItem.name = fixedName
      didUpdate = true
    }
  })
  return didUpdate
}

const updateConfigDeployFormat = (config: NetsuiteConfig): boolean => {
  const { deployReferencedElements } = config
  if (deployReferencedElements === undefined) {
    return false
  }
  // we want to migrate deployReferencedElements only if its value is 'true'
  // (and not if it evaluated to true)
  if (deployReferencedElements === true) {
    config.deploy = {
      ...config.deploy,
      deployReferencedElements,
    }
  }
  delete config.deployReferencedElements
  return true
}

const updateConfigFormat = (config: NetsuiteConfig): {
  didUpdateFetchFormat: boolean
  didUpdateDeployFormat: boolean
  didUpdateSuiteAppTypesFormat: boolean
} => {
  updateConfigSkipListFormat(config)
  return {
    didUpdateFetchFormat: updateConfigFetchFormat(config),
    didUpdateDeployFormat: updateConfigDeployFormat(config),
    didUpdateSuiteAppTypesFormat: updateSuiteAppTypes(config),
  }
}

const toConfigInstance = (config: NetsuiteConfig): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, configType, _.pickBy(config, values.isDefined))

const splitConfig = (config: NetsuiteConfig): InstanceElement[] => {
  const {
    lockedElementsToExclude,
    ...allFetchConfigExceptLockedElements
  } = config.fetch ?? {}
  if (lockedElementsToExclude === undefined) {
    return [toConfigInstance(config)]
  }
  config.fetch = allFetchConfigExceptLockedElements
  const lockedElementsConfig: NetsuiteConfig = {
    fetch: { lockedElementsToExclude },
  }
  return [
    toConfigInstance(config),
    new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      lockedElementsConfig,
      ['lockedElements']
    ),
  ]
}

export const getConfigFromConfigChanges = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: FailedFiles,
  failedTypes: FailedTypes,
  currentConfig: NetsuiteConfig
): { config: InstanceElement[]; message: string } | undefined => {
  const config = _.cloneDeep(currentConfig)
  const {
    didUpdateFetchFormat,
    didUpdateDeployFormat,
    didUpdateSuiteAppTypesFormat,
  } = updateConfigFormat(config)
  const didUpdateFromFailures = updateConfigFromFailures(
    failedToFetchAllAtOnce,
    failedFilePaths,
    failedTypes,
    config
  )
  const messages = [
    didUpdateFromFailures
      ? STOP_MANAGING_ITEMS_MSG
      : undefined,
    didUpdateFetchFormat
      ? UPDATE_FETCH_CONFIG_FORMAT
      : undefined,
    !didUpdateFetchFormat && didUpdateSuiteAppTypesFormat
      ? UPDATE_SUITEAPP_TYPES_CONFIG_FORMAT
      : undefined,
    didUpdateDeployFormat
      ? UPDATE_DEPLOY_CONFIG
      : undefined,
  ].filter(values.isDefined)

  return messages.length > 0 ? {
    config: splitConfig(config),
    message: messages.join(' In addition, '),
  } : undefined
}
