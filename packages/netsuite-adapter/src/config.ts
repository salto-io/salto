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
import { collections, strings, values } from '@salto-io/lowerdash'
import {
  InstanceElement, ElemID, Value, ObjectType, ListType, BuiltinTypes, CORE_ANNOTATIONS,
  createRestriction, MapType,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import {
  FETCH_ALL_TYPES_AT_ONCE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, NETSUITE,
  SDF_CONCURRENCY_LIMIT, DEPLOY_REFERENCED_ELEMENTS, FETCH_TYPE_TIMEOUT_IN_MINUTES,
  CLIENT_CONFIG, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, FETCH_TARGET, SKIP_LIST,
  SUITEAPP_CONCURRENCY_LIMIT, SUITEAPP_CLIENT_CONFIG, USE_CHANGES_DETECTION,
  CONCURRENCY_LIMIT, FETCH, INCLUDE, EXCLUDE, DEPLOY, DATASET, WORKBOOK, WARN_STALE_DATA,
  INSTALLED_SUITEAPPS, LOCKED_ELEMENTS_TO_EXCLUDE, AUTHOR_INFO_CONFIG, ADDITIONAL_DEPS, VALIDATE,
  STRICT_INSTANCE_STRUCTURE,
  FIELDS_TO_OMIT,
  CURRENCY,
  EXCHANGE_RATE,
} from './constants'
import { NetsuiteQueryParameters, FetchParams, convertToQueryParams, QueryParams, FetchTypeQueryParams, FieldToOmitParams } from './query'
import { ITEM_TYPE_TO_SEARCH_STRING, TYPES_TO_INTERNAL_ID } from './data_elements/types'
import { AdditionalSdfDeployDependencies, FailedFiles, FailedTypes } from './client/types'

const { makeArray } = collections.array

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_COMMAND_TIMEOUT_IN_MINUTES = 4
export const DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 40
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false
export const DEFAULT_WARN_STALE_DATA = false
export const DEFAULT_VALIDATE = true
export const DEFAULT_USE_CHANGES_DETECTION = true

const clientConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'clientConfig'),
  fields: {
    [FETCH_ALL_TYPES_AT_ONCE]: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_ALL_TYPES_AT_ONCE,
      },
    },
    [FETCH_TYPE_TIMEOUT_IN_MINUTES]: {
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
    [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    [SDF_CONCURRENCY_LIMIT]: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_CONCURRENCY,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },

    [INSTALLED_SUITEAPPS]: {
      refType: new ListType(BuiltinTypes.STRING),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const suiteAppClientConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'suiteAppClientConfig'),
  fields: {
    [SUITEAPP_CONCURRENCY_LIMIT]: {
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

const queryConfigType = new ObjectType({
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
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fetchTypeQueryParamsConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'fetchTypeQueryParams'),
  fields: {
    name: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    ids: { refType: new ListType(BuiltinTypes.STRING) },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const queryParamsConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'queryParams'),
  fields: {
    types: {
      refType: new ListType(fetchTypeQueryParamsConfigType),
    },
    fileCabinet: {
      refType: new ListType(BuiltinTypes.STRING),
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
  [INCLUDE]: {
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
  [EXCLUDE]: {
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

const authorInfoConfig = new ObjectType({
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
    [INCLUDE]: { refType: queryParamsConfigType },
    [EXCLUDE]: { refType: queryParamsConfigType },
    [LOCKED_ELEMENTS_TO_EXCLUDE]: { refType: queryParamsConfigType },
    [AUTHOR_INFO_CONFIG]: { refType: authorInfoConfig },
    [STRICT_INSTANCE_STRUCTURE]: { refType: BuiltinTypes.BOOLEAN },
    [FIELDS_TO_OMIT]: { refType: new ListType(fieldsToOmitConfig) },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type DeployParams = {
  [WARN_STALE_DATA]?: boolean
  [VALIDATE]?: boolean
  [DEPLOY_REFERENCED_ELEMENTS]?: boolean
  [ADDITIONAL_DEPS]?: {
    [INCLUDE]?: Partial<AdditionalSdfDeployDependencies>
    [EXCLUDE]?: Partial<AdditionalSdfDeployDependencies>
  }
}

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
    [WARN_STALE_DATA]: { refType: BuiltinTypes.BOOLEAN },
    [VALIDATE]: { refType: BuiltinTypes.BOOLEAN },
    [DEPLOY_REFERENCED_ELEMENTS]: { refType: BuiltinTypes.BOOLEAN },
    [ADDITIONAL_DEPS]: { refType: additionalDependenciesType },
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

const configID = new ElemID(NETSUITE)
export const configType = new ObjectType({
  elemID: configID,
  fields: {
    [FETCH]: {
      refType: fetchConfigType,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: fetchDefault,
      },
    },
    [FILE_PATHS_REGEX_SKIP_LIST]: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    [DEPLOY]: {
      refType: deployConfigType,
    },
    [CONCURRENCY_LIMIT]: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
    [CLIENT_CONFIG]: {
      refType: clientConfigType,
    },

    [SUITEAPP_CLIENT_CONFIG]: {
      refType: suiteAppClientConfigType,
    },

    [FETCH_TARGET]: {
      refType: queryConfigType,
    },

    [USE_CHANGES_DETECTION]: {
      refType: BuiltinTypes.BOOLEAN,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

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

export const STOP_MANAGING_ITEMS_MSG = 'Salto failed to fetch some items from NetSuite.'
  + ' In order to complete the fetch operation, Salto needs to stop managing these items by modifying the configuration.'

export const UPDATE_FETCH_CONFIG_FORMAT = 'The configuration options "typeToSkip", "filePathRegexSkipList" and "skipList" are deprecated.'
  + ' To skip items in fetch, please use the "fetch.exclude" option.'
  + ' The following configuration will update the deprecated fields to "fetch.exclude" field.'

export const UPDATE_SUITEAPP_TYPES_CONFIG_FORMAT = 'Some type names have been changed. The following changes will update the type names in the adapter configuration.'

export const UPDATE_DEPLOY_CONFIG = 'All deploy\'s configuration flags are under "deploy" configuration.'
+ ' you may leave "deploy" section as undefined to set all deploy\'s configuration flags to their default value.'

const createExclude = (failedPaths: NetsuiteQueryParameters['filePaths'], failedTypes: NetsuiteQueryParameters['types']): QueryParams =>
  ({
    fileCabinet: failedPaths.map(_.escapeRegExp),
    types: Object.entries(failedTypes).map(([name, ids]) => ({ name, ids })),
  })

const toConfigSuggestions = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: FailedFiles,
  failedTypes: FailedTypes
): Partial<Record<keyof Omit<NetsuiteConfig, 'client'> | keyof SdfClientConfig, Value>> => {
  const fetch: FetchParams = {}
  if (!_.isEmpty(failedFilePaths.otherError) || !_.isEmpty(failedTypes.unexpectedError)) {
    fetch[EXCLUDE] = createExclude(failedFilePaths.otherError, failedTypes.unexpectedError)
  }

  if (!_.isEmpty(failedFilePaths.lockedError) || !_.isEmpty(failedTypes.lockedError)) {
    fetch[LOCKED_ELEMENTS_TO_EXCLUDE] = createExclude(
      failedFilePaths.lockedError,
      failedTypes.lockedError,
    )
  }

  return {
    ...(failedToFetchAllAtOnce ? { [FETCH_ALL_TYPES_AT_ONCE]: false } : {}),
    ...(!_.isEmpty(fetch) ? { [FETCH]: fetch } : {}),
  }
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

const updateConfigFromFailures = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: FailedFiles,
  failedTypes: FailedTypes,
  configToUpdate: NetsuiteConfig,
): boolean => {
  const suggestions = toConfigSuggestions(
    failedToFetchAllAtOnce, failedFilePaths, failedTypes
  )
  if (_.isEmpty(suggestions)) {
    return false
  }

  if (suggestions.fetchAllTypesAtOnce !== undefined) {
    configToUpdate[CLIENT_CONFIG] = _.pickBy({
      ...(configToUpdate[CLIENT_CONFIG] ?? {}),
      [FETCH_ALL_TYPES_AT_ONCE]: suggestions.fetchAllTypesAtOnce,
    }, values.isDefined)
  }

  const currentFetch = configToUpdate[FETCH]
  const currentExclude = currentFetch?.[EXCLUDE] !== undefined
    ? _.cloneDeep(currentFetch[EXCLUDE])
    : { types: [], fileCabinet: [] }


  const suggestedExclude = suggestions[FETCH]?.[EXCLUDE]
  const newExclude = combineQueryParams(currentExclude, suggestedExclude)

  const newLockedElementToExclude = currentFetch?.[LOCKED_ELEMENTS_TO_EXCLUDE] !== undefined
    || suggestions[FETCH]?.[LOCKED_ELEMENTS_TO_EXCLUDE] !== undefined
    ? combineQueryParams(
      currentFetch?.[LOCKED_ELEMENTS_TO_EXCLUDE],
      suggestions[FETCH]?.[LOCKED_ELEMENTS_TO_EXCLUDE]
    )
    : undefined

  configToUpdate[FETCH] = {
    ...(configToUpdate[FETCH] ?? {}),
    [EXCLUDE]: newExclude,
    ...(newLockedElementToExclude !== undefined
      ? { [LOCKED_ELEMENTS_TO_EXCLUDE]: newLockedElementToExclude }
      : {}),
  }

  return true
}

const updateConfigSkipListFormat = (
  configToUpdate: InstanceElement,
): boolean => {
  if (configToUpdate.value[TYPES_TO_SKIP] === undefined
    && configToUpdate.value[FILE_PATHS_REGEX_SKIP_LIST] === undefined) {
    return false
  }

  const currentSkipList = configToUpdate.value[SKIP_LIST]
  const newSkipList: Partial<NetsuiteQueryParameters> = currentSkipList !== undefined
    ? _.cloneDeep(currentSkipList)
    : {}

  const deprecatedTypesToSkip = configToUpdate.value[TYPES_TO_SKIP]
  if (deprecatedTypesToSkip !== undefined) {
    if (newSkipList.types === undefined) {
      newSkipList.types = {}
    }

    _.assign(newSkipList.types, Object.fromEntries(
      makeArray(deprecatedTypesToSkip).map((type: string) => [type, ['.*']])
    ))
  }

  const deprecatedFilePathRegexSkipList = configToUpdate.value[FILE_PATHS_REGEX_SKIP_LIST]
  if (deprecatedFilePathRegexSkipList !== undefined) {
    if (newSkipList.filePaths === undefined) {
      newSkipList.filePaths = []
    }

    newSkipList.filePaths.push(
      ...makeArray(deprecatedFilePathRegexSkipList).map(convertDeprecatedFilePathRegex)
    )
  }

  configToUpdate.value[SKIP_LIST] = newSkipList
  delete configToUpdate.value[TYPES_TO_SKIP]
  delete configToUpdate.value[FILE_PATHS_REGEX_SKIP_LIST]

  return true
}

const updateConfigFetchFormat = (
  configToUpdate: InstanceElement,
): boolean => {
  if (configToUpdate.value[SKIP_LIST] === undefined) {
    return false
  }

  const typesToExclude: QueryParams = configToUpdate.value[SKIP_LIST] !== undefined
    ? convertToQueryParams(configToUpdate.value[SKIP_LIST])
    : { types: [], fileCabinet: [] }

  delete configToUpdate.value[SKIP_LIST]

  const currentFetch = configToUpdate.value[FETCH]
  if (currentFetch !== undefined) {
    configToUpdate.value[FETCH] = {
      [INCLUDE]: currentFetch[INCLUDE],
      [EXCLUDE]: combineQueryParams(currentFetch[EXCLUDE], typesToExclude),
    }
    return true
  }

  const newFetch: FetchParams = {
    [INCLUDE]: fetchDefault[INCLUDE],
    [EXCLUDE]: combineQueryParams(typesToExclude, fetchDefault[EXCLUDE]),
  }
  configToUpdate.value[FETCH] = newFetch
  return true
}

const updateSuiteAppTypes = (
  configToUpdate: InstanceElement,
): boolean => {
  let didUpdate = false
  configToUpdate.value?.[FETCH]?.[EXCLUDE]?.types?.forEach((excludeItem: FetchTypeQueryParams) => {
    if (excludeItem.name !== undefined) {
      const fixedName = strings.lowerCaseFirstLetter(excludeItem.name)
      if (excludeItem.name !== fixedName && fixedName in TYPES_TO_INTERNAL_ID) {
        excludeItem.name = fixedName
        didUpdate = true
      }
    }
  })
  return didUpdate
}

const updateConfigDeployFormat = (
  configToUpdate: InstanceElement,
): boolean => {
  const deployReferencedElements = configToUpdate.value[DEPLOY_REFERENCED_ELEMENTS]
  if (deployReferencedElements === undefined) {
    return false
  }
  // we want to migrate deployReferencedElements only if its value is 'true'
  // (and not if it evaluated to true)
  if (deployReferencedElements === true) {
    configToUpdate.value[DEPLOY] = {
      [DEPLOY_REFERENCED_ELEMENTS]: deployReferencedElements,
    }
  }
  delete configToUpdate.value[DEPLOY_REFERENCED_ELEMENTS]
  return true
}

const updateConfigFormat = (
  configToUpdate: InstanceElement,
): {
  didUpdateFetchFormat: boolean
  didUpdateDeployFormat: boolean
  didUpdateSuiteAppTypesFormat: boolean
} => {
  updateConfigSkipListFormat(configToUpdate)
  return {
    didUpdateFetchFormat: updateConfigFetchFormat(configToUpdate),
    didUpdateDeployFormat: updateConfigDeployFormat(configToUpdate),
    didUpdateSuiteAppTypesFormat: updateSuiteAppTypes(configToUpdate),
  }
}

const splitConfig = (config: InstanceElement): InstanceElement[] => {
  const lockedElementsToExclude = config.value[FETCH]?.[LOCKED_ELEMENTS_TO_EXCLUDE]
  if (lockedElementsToExclude === undefined) {
    return [config]
  }
  delete config.value[FETCH]?.[LOCKED_ELEMENTS_TO_EXCLUDE]
  const lockedElementsToExcludeConf = new InstanceElement(ElemID.CONFIG_NAME, configType, { [FETCH]: { [LOCKED_ELEMENTS_TO_EXCLUDE]: lockedElementsToExclude } }, ['lockedElements'])
  return [config, lockedElementsToExcludeConf]
}

export const getConfigFromConfigChanges = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: FailedFiles,
  failedTypes: FailedTypes,
  currentConfig: NetsuiteConfig
): { config: InstanceElement[]; message: string } | undefined => {
  const conf = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    _.pickBy(_.cloneDeep(currentConfig), values.isDefined),
  )

  const {
    didUpdateFetchFormat,
    didUpdateDeployFormat,
    didUpdateSuiteAppTypesFormat,
  } = updateConfigFormat(conf)
  const didUpdateFromFailures = updateConfigFromFailures(
    failedToFetchAllAtOnce,
    failedFilePaths,
    failedTypes,
    conf.value
  )
  const message = [
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
  ].filter(values.isDefined).join(' In addition, ')

  return message !== '' ? { config: splitConfig(conf), message } : undefined
}
