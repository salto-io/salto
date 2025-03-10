/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { InstanceElement } from '@salto-io/adapter-api'
import { CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT, FILE_CABINET_PATH_SEPARATOR, INACTIVE_FIELDS } from '../constants'
import { removeCustomRecordTypePrefix } from '../types'
import { fileCabinetTypesNames } from '../types/file_cabinet_types'
import {
  ClientConfig,
  CriteriaQuery,
  CONFIG,
  CLIENT_CONFIG,
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
  if (config.fetchTarget === undefined) {
    return undefined
  }
  const { types = {}, filePaths = [], customRecords = {} } = config.fetchTarget
  // in case that custom records are fetched, we want to fetch their types too-
  // using this config: { types: { customrecordtype: [<customRecordTypes>] } }.
  // without that addition, the custom record types wouldn't be fetched
  // and we wouldn't be able to fetch the custom record instances.
  const customRecordTypeNames = Object.keys(customRecords)
  // custom record types that have custom segments are fetch by them
  // so we need to fetch the matching custom segments too.
  const customSegmentNames = customRecordTypeNames.map(removeCustomRecordTypePrefix).filter(name => name.length > 0)
  const customRecordTypesQuery = (types[CUSTOM_RECORD_TYPE] ?? []).concat(customRecordTypeNames)
  const customSegmentsQuery = (types[CUSTOM_SEGMENT] ?? []).concat(customSegmentNames)

  const filePathsFolders = filePaths
    .map(path => path.substring(0, path.lastIndexOf(FILE_CABINET_PATH_SEPARATOR) + 1))
    .filter(path => path !== FILE_CABINET_PATH_SEPARATOR)
    // in case that the query was like ".*\.js" (all js files), we want to query all folders
    .map(path => (path === '' ? `.*${FILE_CABINET_PATH_SEPARATOR}` : path))
    .filter(regex.isValidRegex)
  const updatedFilePaths = _.uniq(filePaths.concat(filePathsFolders))

  return {
    types: {
      ...types,
      ...(customRecordTypesQuery.length > 0 ? { [CUSTOM_RECORD_TYPE]: customRecordTypesQuery } : {}),
      ...(customSegmentsQuery.length > 0 ? { [CUSTOM_SEGMENT]: customSegmentsQuery } : {}),
    },
    filePaths: updatedFilePaths,
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

const updateClientConfig = (config: NetsuiteConfig): ClientConfig | undefined => {
  if (config.fetchTarget !== undefined && config.client?.fetchAllTypesAtOnce) {
    log.warn(
      `${CLIENT_CONFIG.fetchAllTypesAtOnce} is not supported with ${CONFIG.fetchTarget}. Ignoring ${CLIENT_CONFIG.fetchAllTypesAtOnce}`,
    )
    return { ...config.client, fetchAllTypesAtOnce: false }
  }
  return config.client
}

const updatedConfig = (config: NetsuiteConfig): NetsuiteConfig => {
  log.debug('user netsuite adapter config: %o', loggableConfig(config))
  const updated: NetsuiteConfig = {
    ...config,
    client: updateClientConfig(config),
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

export const netsuiteConfigFromConfig = (
  configInstance: Readonly<InstanceElement> | undefined,
  { throwOnError = true }: { throwOnError?: boolean } = {},
): { config: NetsuiteConfig; originalConfig: NetsuiteConfig } => {
  if (!configInstance) {
    log.warn('missing config instance - using netsuite adapter config with full fetch')
    return {
      config: { fetch: fullFetchConfig() },
      originalConfig: { fetch: fullFetchConfig() },
    }
  }
  try {
    const { value: originalConfig } = configInstance
    validateConfig(originalConfig)
    const config = updatedConfig(originalConfig)
    return { config, originalConfig }
  } catch (error) {
    if (throwOnError) {
      throw error
    }
    log.debug('ignoring config validation error - using netsuite adapter config with full fetch')
    return {
      config: { fetch: fullFetchConfig() },
      originalConfig: { fetch: fullFetchConfig() },
    }
  }
}
