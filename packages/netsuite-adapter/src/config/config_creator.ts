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
import _ from 'lodash'
import { regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { InstanceElement } from '@salto-io/adapter-api'
import { CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT, INACTIVE_FIELDS } from '../constants'
import { removeCustomRecordTypePrefix } from '../types'
import { fileCabinetTypesNames } from '../types/file_cabinet_types'
import {
  ClientConfig,
  CriteriaQuery,
  FETCH_PARAMS,
  FetchParams,
  FetchTypeQueryParams,
  InstanceLimiterFunc,
  NetsuiteConfig,
  NetsuiteQueryParameters,
  QueryParams,
} from './types'
import {
  ALL_TYPES_REGEX,
  DATA_FILE_TYPES,
  DEFAULT_MAX_INSTANCES_PER_TYPE,
  DEFAULT_MAX_INSTANCES_VALUE,
  EXTENSION_REGEX,
  FILE_CABINET,
  GROUPS_TO_DATA_FILE_TYPES,
  INCLUDE_ALL,
  UNLIMITED_INSTANCES_VALUE,
} from './constants'
import { validateConfig } from './validations'

const log = logger(module)

const loggableConfig = (config: NetsuiteConfig): NetsuiteConfig => ({
  ...config,
  fetch: _.omit(config.fetch, FETCH_PARAMS.lockedElementsToExclude),
})

export const fullQueryParams = (): QueryParams => ({
  types: [{ name: ALL_TYPES_REGEX }],
  fileCabinet: [ALL_TYPES_REGEX],
  customRecords: [{ name: ALL_TYPES_REGEX }],
})

export const emptyQueryParams = (): QueryParams => ({
  types: [],
  fileCabinet: [],
})

export const fullFetchConfig = (): FetchParams => ({
  include: fullQueryParams(),
  exclude: emptyQueryParams(),
})

const updatedFetchTarget = (config: NetsuiteConfig): NetsuiteQueryParameters | undefined => {
  if (config.fetchTarget?.customRecords === undefined) {
    return config.fetchTarget
  }
  const { types, filePaths, customRecords } = config.fetchTarget
  // in case that custom records are fetched, we want to fetch their types too-
  // using this config: { types: { customrecordtype: [<customRecordTypes>] } }.
  // without that addition, the custom record types wouldn't be fetched
  // and we wouldn't be able to fetch the custom record instances.
  const customRecordTypeNames = Object.keys(customRecords)
  // custom record types that have custom segments are fetch by them
  // so we need to fetch the matching custom segments too.
  const customSegmentNames = customRecordTypeNames.map(removeCustomRecordTypePrefix).filter(name => name.length > 0)
  const customRecordTypesQuery = (types?.[CUSTOM_RECORD_TYPE] ?? []).concat(customRecordTypeNames)
  const customSegmentsQuery = (types?.[CUSTOM_SEGMENT] ?? []).concat(customSegmentNames)
  return {
    types: {
      ...types,
      [CUSTOM_RECORD_TYPE]: customRecordTypesQuery,
      [CUSTOM_SEGMENT]: customSegmentsQuery,
    },
    filePaths,
    customRecords,
  }
}

const includeFileCabinetFolders = (config: NetsuiteConfig): string[] =>
  config.includeFileCabinetFolders?.map(
    folderName => `^${folderName.startsWith('/') ? '' : '/'}${folderName}${folderName.endsWith('/') ? '' : '/'}.*`,
  ) ?? []

const includeCustomRecords = (config: NetsuiteConfig): FetchTypeQueryParams[] => {
  if (config.includeCustomRecords === undefined || config.includeCustomRecords.length === 0) {
    return []
  }
  if (config.includeCustomRecords.includes(INCLUDE_ALL)) {
    return [{ name: ALL_TYPES_REGEX }]
  }
  return [{ name: config.includeCustomRecords.join('|') }]
}

const excludeInactiveRecords = (config: NetsuiteConfig): CriteriaQuery | undefined => {
  if (config.includeInactiveRecords === undefined || config.includeInactiveRecords.includes(INCLUDE_ALL)) {
    return undefined
  }

  const typesToInclude = config.includeInactiveRecords.flatMap(typeName =>
    typeName === FILE_CABINET ? fileCabinetTypesNames : typeName,
  )

  const inactiveRecordsToExcludeRegex =
    typesToInclude.length === 0
      ? ALL_TYPES_REGEX
      : // match all except for the exact strings in typesToInclude
        `(?!(${typesToInclude.join('|')})$).*`

  return {
    name: inactiveRecordsToExcludeRegex,
    criteria: {
      [INACTIVE_FIELDS.isInactive]: true,
    },
  }
}

const excludeDataFileTypes = (config: NetsuiteConfig): string[] => {
  if (config.includeDataFileTypes === undefined) {
    return []
  }
  const dataFileTypesToInclude = new Set(
    config.includeDataFileTypes.flatMap(group => GROUPS_TO_DATA_FILE_TYPES[group] ?? []),
  )
  const dataFileTypesToExclude = Object.values(DATA_FILE_TYPES).filter(
    fileType => !dataFileTypesToInclude.has(fileType),
  )
  if (dataFileTypesToExclude.length === 0) {
    return []
  }
  const dataFileTypesToExcludeRegex = `${EXTENSION_REGEX}(${dataFileTypesToExclude.join('|')})`
  return [dataFileTypesToExcludeRegex.toLowerCase(), dataFileTypesToExcludeRegex.toUpperCase()]
}

const updatedFetchInclude = (config: NetsuiteConfig): QueryParams => ({
  ...config.fetch.include,
  fileCabinet: config.fetch.include.fileCabinet.concat(includeFileCabinetFolders(config)),
  customRecords: (config.fetch.include.customRecords ?? []).concat(includeCustomRecords(config)),
})

const updatedFetchExclude = (config: NetsuiteConfig): QueryParams => ({
  ...config.fetch.exclude,
  types: config.fetch.exclude.types.concat(excludeInactiveRecords(config) ?? []),
  fileCabinet: config.fetch.exclude.fileCabinet.concat(excludeDataFileTypes(config)),
})

const updatedFetchConfig = (config: NetsuiteConfig): FetchParams => ({
  ...config.fetch,
  include: updatedFetchInclude(config),
  exclude: updatedFetchExclude(config),
})

const updatedConfig = (config: NetsuiteConfig): NetsuiteConfig => {
  log.debug('user netsuite adapter config: %o', loggableConfig(config))
  const updated: NetsuiteConfig = {
    ...config,
    fetchTarget: updatedFetchTarget(config),
    fetch: updatedFetchConfig(config),
  }
  log.debug('updated netsuite adapter config: %o', loggableConfig(updated))
  return updated
}

export const instanceLimiterCreator =
  (clientConfig?: ClientConfig): InstanceLimiterFunc =>
  (type, instanceCount): boolean => {
    // Return true if there are more `instanceCount` of the `type` than any of the rules matched.
    // The rules matched include the default amount defined: DEFAULT_MAX_INSTANCES_VALUE.
    // If there is a rule with UNLIMITED_INSTANCES_VALUE, this will always return false.
    if (instanceCount < DEFAULT_MAX_INSTANCES_VALUE) {
      return false
    }
    const maxInstancesPerType = DEFAULT_MAX_INSTANCES_PER_TYPE.concat(clientConfig?.maxInstancesPerType ?? [])
    const maxInstancesOptions = maxInstancesPerType
      .filter(maxType => regex.isFullRegexMatch(type, maxType.name))
      .map(maxType => maxType.limit)
    if (maxInstancesOptions.some(limit => limit === UNLIMITED_INSTANCES_VALUE)) {
      return false
    }
    return maxInstancesOptions.every(limit => instanceCount > limit)
  }

export const netsuiteConfigFromConfig = (configInstance: Readonly<InstanceElement> | undefined): NetsuiteConfig => {
  if (!configInstance) {
    log.warn('missing config instance - using netsuite adapter config with full fetch')
    return { fetch: fullFetchConfig() }
  }
  const { value: config } = configInstance
  validateConfig(config)
  return updatedConfig(config)
}
