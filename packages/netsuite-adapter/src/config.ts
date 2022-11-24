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
import _ from 'lodash'
import { strings, values } from '@salto-io/lowerdash'
import {
  InstanceElement, ElemID, ListType, BuiltinTypes, CORE_ANNOTATIONS,
  createRestriction, MapType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import {
  FETCH_ALL_TYPES_AT_ONCE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, NETSUITE,
  SDF_CONCURRENCY_LIMIT, DEPLOY_REFERENCED_ELEMENTS, FETCH_TYPE_TIMEOUT_IN_MINUTES,
  CLIENT_CONFIG, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, FETCH_TARGET, SKIP_LIST,
  SUITEAPP_CONCURRENCY_LIMIT, SUITEAPP_CLIENT_CONFIG, USE_CHANGES_DETECTION,
  CONCURRENCY_LIMIT, FETCH, INCLUDE, EXCLUDE, DEPLOY, DATASET, WORKBOOK, WARN_STALE_DATA,
  INSTALLED_SUITEAPPS, ADDITIONAL_DEPS, VALIDATE, CURRENCY,
  EXCHANGE_RATE,
} from './constants'
import { NetsuiteQueryParameters, FetchParams, convertToQueryParams, QueryParams, FetchTypeQueryParams, FieldToOmitParams } from './query'
import { ITEM_TYPE_TO_SEARCH_STRING, TYPES_TO_INTERNAL_ID } from './data_elements/types'
import { AdditionalSdfDeployDependencies, FailedFiles, FailedTypes } from './client/types'

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_COMMAND_TIMEOUT_IN_MINUTES = 4
export const DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 40
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false
export const DEFAULT_WARN_STALE_DATA = false
export const DEFAULT_VALIDATE = true
export const DEFAULT_USE_CHANGES_DETECTION = true

export type DeployParams = {
  [WARN_STALE_DATA]?: boolean
  [VALIDATE]?: boolean
  [DEPLOY_REFERENCED_ELEMENTS]?: boolean
  [ADDITIONAL_DEPS]?: {
    [INCLUDE]?: Partial<AdditionalSdfDeployDependencies>
    [EXCLUDE]?: Partial<AdditionalSdfDeployDependencies>
  }
}

export type SdfClientConfig = {
  [FETCH_ALL_TYPES_AT_ONCE]?: boolean
  [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]?: number
  [FETCH_TYPE_TIMEOUT_IN_MINUTES]?: number
  [SDF_CONCURRENCY_LIMIT]?: number
  [INSTALLED_SUITEAPPS]?: string[]
}

export type SuiteAppClientConfig = {
  [SUITEAPP_CONCURRENCY_LIMIT]?: number
}

export type NetsuiteConfig = {
  [TYPES_TO_SKIP]?: string[]
  [FILE_PATHS_REGEX_SKIP_LIST]?: string[]
  [DEPLOY]?: DeployParams
  [CONCURRENCY_LIMIT]?: number
  [CLIENT_CONFIG]?: SdfClientConfig
  [SUITEAPP_CLIENT_CONFIG]?: SuiteAppClientConfig
  [FETCH]?: FetchParams
  [FETCH_TARGET]?: NetsuiteQueryParameters
  [SKIP_LIST]?: NetsuiteQueryParameters
  [USE_CHANGES_DETECTION]?: boolean
  [DEPLOY_REFERENCED_ELEMENTS]?: boolean
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
      },
    },
    filePaths: {
      refType: (new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    },
    // SALTO-2994 uncomment in order to support custom records quick fetch
    // customRecords: {
    //   refType: new MapType(new ListType(BuiltinTypes.STRING)),
    //   annotations: {
    //     [CORE_ANNOTATIONS.DEFAULT]: {},
    //   },
    // },
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
  elemID: new ElemID(NETSUITE, `${ADDITIONAL_DEPS}Inner`),
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
  elemID: new ElemID(NETSUITE, ADDITIONAL_DEPS),
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

const validateAdditionalDependencies = (
  additionalDependencies: DeployParams['additionalDependencies']
): void => {
  if (!_.isObject(additionalDependencies)) {
    throw new Error(`Expected "additionalDependencies" to be an object or to be undefined, but received:\n ${additionalDependencies}`)
  }
  const { include, exclude } = additionalDependencies
  Object.entries({ include, exclude }).forEach(([configName, configValue]) => {
    if (configValue === undefined) {
      return
    }
    const { features, objects } = configValue
    Object.entries({ features, objects }).forEach(([fieldName, fieldValue]) => {
      if (fieldValue !== undefined && (
        !_.isArray(fieldValue) || fieldValue.some(item => typeof item !== 'string')
      )) {
        throw new Error(`Expected "${configName}.${fieldName}" to be a list of strings or to be undefined, but received:\n ${fieldValue}`)
      }
    })
  })
}

export const validateDeployParams = (
  {
    deployReferencedElements,
    warnOnStaleWorkspaceData,
    validate,
    additionalDependencies,
  }: Partial<DeployParams>
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
    config[FETCH] = {
      ...config[FETCH],
      exclude: createExclude({
        filePaths: failedFilePaths.otherError,
        types: failedTypes.unexpectedError,
      }),
    }
  }
  if (!_.isEmpty(failedFilePaths.lockedError) || !_.isEmpty(failedTypes.lockedError)) {
    config[FETCH] = {
      ...config[FETCH],
      lockedElementsToExclude: createExclude({
        filePaths: failedFilePaths.lockedError,
        types: failedTypes.lockedError,
      }),
    }
  }
  if (failedToFetchAllAtOnce) {
    config[CLIENT_CONFIG] = {
      ...config[CLIENT_CONFIG],
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
      : { ids: _.uniq(types.flatMap(type => type.ids as string[])) },
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
    config[CLIENT_CONFIG] = {
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

  config[FETCH] = updatedFetchConfig
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
  config[SKIP_LIST] = skipList
  delete config[TYPES_TO_SKIP]
  delete config[FILE_PATHS_REGEX_SKIP_LIST]
}

const updateConfigFetchFormat = (config: NetsuiteConfig): boolean => {
  const { skipList, fetch } = config
  if (skipList === undefined) {
    return false
  }

  const typesToExclude = convertToQueryParams(skipList)
  delete config[SKIP_LIST]

  config[FETCH] = fetch !== undefined ? {
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
  config[FETCH]?.exclude?.types.forEach(excludeItem => {
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
    config[DEPLOY] = {
      ...config[DEPLOY],
      deployReferencedElements,
    }
  }
  delete config[DEPLOY_REFERENCED_ELEMENTS]
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
  } = config[FETCH] ?? {}
  if (lockedElementsToExclude === undefined) {
    return [toConfigInstance(config)]
  }
  config[FETCH] = allFetchConfigExceptLockedElements
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
