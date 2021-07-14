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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import {
  InstanceElement, ElemID, Value, ObjectType, ListType, BuiltinTypes, CORE_ANNOTATIONS,
  createRestriction, MapType,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue, createMatchingObjectType } from '@salto-io/adapter-utils'
import {
  FETCH_ALL_TYPES_AT_ONCE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, NETSUITE,
  SDF_CONCURRENCY_LIMIT, DEPLOY_REFERENCED_ELEMENTS, FETCH_TYPE_TIMEOUT_IN_MINUTES,
  CLIENT_CONFIG, MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, FETCH_TARGET, SKIP_LIST,
  SUITEAPP_CONCURRENCY_LIMIT, SUITEAPP_CLIENT_CONFIG, USE_CHANGES_DETECTION,
  CONCURRENCY_LIMIT, FETCH, INCLUDE, EXCLUDE, SAVED_SEARCH, DEPLOY, DATASET, WORKBOOK,
} from './constants'
import { NetsuiteQueryParameters, FetchParams, convertToQueryParams, QueryParams, FetchTypeQueryParams } from './query'

const { makeArray } = collections.array

// in small Netsuite accounts the concurrency limit per integration can be between 1-4
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_FETCH_ALL_TYPES_AT_ONCE = false
export const DEFAULT_COMMAND_TIMEOUT_IN_MINUTES = 4
export const DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 40
export const DEFAULT_DEPLOY_REFERENCED_ELEMENTS = false
export const DEFAULT_USE_CHANGES_DETECTION = true

const clientConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'clientConfig'),
  fields: {
    [FETCH_ALL_TYPES_AT_ONCE]: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_FETCH_ALL_TYPES_AT_ONCE,
      },
    },
    [FETCH_TYPE_TIMEOUT_IN_MINUTES]: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
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
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
        }),
      },
    },
    [SDF_CONCURRENCY_LIMIT]: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_CONCURRENCY,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
  },
})

const suiteAppClientConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'suiteAppClientConfig'),
  fields: {
    [SUITEAPP_CONCURRENCY_LIMIT]: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_CONCURRENCY,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
  },
})

const queryConfigType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'queryConfig'),
  fields: {
    types: {
      refType: createRefToElmWithValue(new MapType(new ListType(BuiltinTypes.STRING))),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {},
      },
    },

    filePaths: {
      refType: createRefToElmWithValue((new ListType(BuiltinTypes.STRING))),
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    },
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
  },
})

export const fetchDefault: FetchParams = {
  [INCLUDE]: {
    types: [{
      name: '.*',
    }],
    fileCabinet: [
      '^/SuiteScripts/.*',
      '^/Templates/.*',
      '^/SuiteBundles/.*',
    ],
  },
  [EXCLUDE]: {
    types: [
      // Has a definition field which is a long XML and it contains 'translationScriptId'
      // value that changes every fetch
      { name: WORKBOOK },
      // Has a definition field which is a long XML and it contains 'translationScriptId'
      // value that changes every fetch
      { name: DATASET },
      // Due to https://github.com/oracle/netsuite-suitecloud-sdk/issues/127 we receive changes each fetch.
      // Although the SAVED_SEARCH is not editable since it's encrypted, there still might be
      // a value for specific customers to use it for moving between envs, backup etc.
      { name: SAVED_SEARCH },
      { name: 'Customer' },
      { name: 'AccountingPeriod' },
      { name: 'Employee' },
      { name: 'Job' },
      { name: 'ManufacturingCostTemplate' },
      { name: 'Partner' },
      { name: 'Solution' },

      // the two below require special features enabled in the account. O.W fetch will fail
      { name: 'GiftCertificateItem' },
      { name: 'DownloadItem' },
    ],
    fileCabinet: [],
  },
}

const fetchConfigType = createMatchingObjectType<FetchParams>({
  elemID: new ElemID(NETSUITE, 'fetchConfig'),
  fields: {
    [INCLUDE]: { refType: queryParamsConfigType },
    [EXCLUDE]: { refType: queryParamsConfigType },
  },
})

export type DeployParams = {
  [DEPLOY_REFERENCED_ELEMENTS]?: boolean
}

const deployConfigType = createMatchingObjectType<DeployParams>({
  elemID: new ElemID(NETSUITE, 'deployConfig'),
  fields: {
    [DEPLOY_REFERENCED_ELEMENTS]: { refType: BuiltinTypes.BOOLEAN },
  },
})

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
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
    },
    [DEPLOY]: {
      refType: deployConfigType,
    },
    [CONCURRENCY_LIMIT]: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 50,
        }),
      },
    },
    [CLIENT_CONFIG]: {
      refType: createRefToElmWithValue(clientConfigType),
    },

    [SUITEAPP_CLIENT_CONFIG]: {
      refType: createRefToElmWithValue(suiteAppClientConfigType),
    },

    [FETCH_TARGET]: {
      refType: createRefToElmWithValue(queryConfigType),
    },

    [USE_CHANGES_DETECTION]: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
    },
  },
})

export type SdfClientConfig = {
  [FETCH_ALL_TYPES_AT_ONCE]?: boolean
  [MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST]?: number
  [FETCH_TYPE_TIMEOUT_IN_MINUTES]?: number
  [SDF_CONCURRENCY_LIMIT]?: number
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
  + ' In order to complete the fetch operation, Salto needs to stop managing these items by adding the items to the configuration fetch.exclude.'

export const UPDATE_FETCH_CONFIG_FORMAT = 'The configuration options "typeToSkip", "filePathRegexSkipList" and "skipList" are deprecated.'
  + ' To skip items in fetch, please use the "fetch.exclude" option.'
  + ' The following configuration will update the deprecated fields to "fetch.exclude" field.'

export const UPDATE_DEPLOY_CONFIG = 'All deploy\'s configuration flags are under "deploy" configuration.'
+ ' you may leave "deploy" section as undefined to set all deploy\'s configuration flags to their default value.'

const toConfigSuggestions = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: NetsuiteQueryParameters['filePaths'],
  failedTypeToInstances: NetsuiteQueryParameters['types']
): Partial<Record<keyof Omit<NetsuiteConfig, 'client'> | keyof SdfClientConfig, Value>> => ({
  ...(failedToFetchAllAtOnce ? { [FETCH_ALL_TYPES_AT_ONCE]: false } : {}),
  ...(!_.isEmpty(failedFilePaths) || !_.isEmpty(failedTypeToInstances)
    ? {
      [FETCH]: {
        [EXCLUDE]: {
          fileCabinet:
           failedFilePaths.map(_.escapeRegExp),
          types:
           Object.entries(failedTypeToInstances).map(([name, ids]) =>
             ({ name, ids })),
        },
      },
    }
    : {}),

})


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

export const combineQueryParams = (
  first: QueryParams | undefined,
  second: QueryParams | undefined,
): QueryParams => {
  if (first === undefined || second === undefined) {
    return first ?? second ?? { types: [], fileCabinet: [] }
  }

  // case where both are defined
  const newFileCabinet = _(first.fileCabinet)
    .concat(second.fileCabinet)
    .uniq()
    .value()
  // uniting first's and second's types. without duplications
  const newTypes: FetchTypeQueryParams[] = _(first.types)
    .concat(second.types)
    .groupBy(type => type.name)
    .map((types, name) => ({
      name,
      ids: types.some(type => type.ids === undefined)
        ? undefined
        : _.uniq(types.flatMap(type => type.ids as string[])),
    }))
    .value()
  return {
    fileCabinet: newFileCabinet,
    types: newTypes,
  }
}

const updateConfigFromFailures = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: NetsuiteQueryParameters['filePaths'],
  failedTypeToInstances: NetsuiteQueryParameters['types'],
  configToUpdate: InstanceElement,
): boolean => {
  const suggestions = toConfigSuggestions(
    failedToFetchAllAtOnce, failedFilePaths, failedTypeToInstances
  )
  if (_.isEmpty(suggestions)) {
    return false
  }

  if (suggestions.fetchAllTypesAtOnce !== undefined) {
    configToUpdate.value[CLIENT_CONFIG] = _.pickBy({
      ...(configToUpdate.value[CLIENT_CONFIG] ?? {}),
      [FETCH_ALL_TYPES_AT_ONCE]: suggestions.fetchAllTypesAtOnce,
    }, values.isDefined)
  }

  const currentFetch = configToUpdate.value[FETCH]
  const currentExclude = currentFetch?.[EXCLUDE] !== undefined
    ? _.cloneDeep(currentFetch[EXCLUDE])
    : { types: [], fileCabinet: [] }


  const suggestedExclude = suggestions[FETCH]?.[EXCLUDE]
  const newExclude = combineQueryParams(currentExclude, suggestedExclude)

  configToUpdate.value[FETCH] = {
    ...(configToUpdate.value[FETCH] ?? {}),
    [EXCLUDE]: newExclude,
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
    ? convertToQueryParams(
      configToUpdate.value[SKIP_LIST]
    )
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
): { didUpdateFetchFormat: boolean; didUpdateDeployFormat: boolean } => {
  updateConfigSkipListFormat(configToUpdate)
  return {
    didUpdateFetchFormat: updateConfigFetchFormat(configToUpdate),
    didUpdateDeployFormat: updateConfigDeployFormat(configToUpdate),
  }
}

export const validateDeployParams = ({ deployReferencedElements }:
  Partial<DeployParams>): void => {
  if (deployReferencedElements !== undefined
    && typeof deployReferencedElements !== 'boolean') {
    throw new Error(`Expected "deployReferencedElements" to be boolean or to be undefined, but received:\n ${deployReferencedElements}`)
  }
}

export const getConfigFromConfigChanges = (
  failedToFetchAllAtOnce: boolean,
  failedFilePaths: NetsuiteQueryParameters['filePaths'],
  failedTypeToInstances: NetsuiteQueryParameters['types'],
  currentConfig: NetsuiteConfig
): { config: InstanceElement; message: string } | undefined => {
  const conf = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    _.pickBy(_.cloneDeep(currentConfig), values.isDefined),
  )

  const { didUpdateFetchFormat, didUpdateDeployFormat } = updateConfigFormat(conf)
  const didUpdateFromFailures = updateConfigFromFailures(
    failedToFetchAllAtOnce,
    failedFilePaths,
    failedTypeToInstances,
    conf
  )
  const message = [
    didUpdateFromFailures
      ? STOP_MANAGING_ITEMS_MSG
      : undefined,
    didUpdateFetchFormat
      ? UPDATE_FETCH_CONFIG_FORMAT
      : undefined,
    didUpdateDeployFormat
      ? UPDATE_DEPLOY_CONFIG
      : undefined,
  ].filter(values.isDefined).join(' In addition, ')

  return message !== '' ? { config: conf, message } : undefined
}
