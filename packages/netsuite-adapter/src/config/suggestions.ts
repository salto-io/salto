/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { formatConfigSuggestionsReasons } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { INACTIVE_FIELDS } from '../constants'
import {
  FetchTypeQueryParams,
  LockedElementsConfig,
  NetsuiteConfig,
  NetsuiteFilePathsQueryParams,
  NetsuiteTypesQueryParams,
  QueryParams,
  configType,
} from './types'
import { FetchByQueryFailures, convertToQueryParams, isCriteriaQuery } from './query'
import { emptyQueryParams, fullFetchConfig } from './config_creator'

const DEPRECATED_CONFIGS_TO_REMOVE = [
  'fetch.skipResolvingAccountSpecificValuesToTypes',
  'fetch.addAlias',
  'fetch.addBundles',
  'fetch.addImportantValues',
  'fetch.addLockedCustomRecordTypes',
  'fetch.forceFileCabinetExclude',
  'fetch.calculateNewReferencesInSuiteScripts',
  'fetch.useNewReferencesInSuiteScripts',
  'fetch.resolveAccountSpecificValues',
  'suiteAppClient.maxRecordsPerSuiteQLTable',
  'useChangesDetection',
  'withPartialDeletion',
  'deployReferencedElements',
]

export const STOP_MANAGING_ITEMS_MSG =
  'Salto failed to fetch some items from NetSuite. Failed items must be excluded from the fetch.'

export const toLargeSizeFoldersExcludedMessage = (updatedLargeFolders: NetsuiteFilePathsQueryParams): string =>
  `The following File Cabinet folders exceed File Cabinet's size limitation: ${updatedLargeFolders.join(', ')}.` +
  " To include them, increase the File Cabinet's size limitation and remove their exclusion rules from the configuration file."

export const toLargeFilesCountFoldersExcludedMessage = (updatedLargeFolders: NetsuiteFilePathsQueryParams): string =>
  `The following File Cabinet folders exceed the limit of allowed amount of files in a folder: ${updatedLargeFolders.join(', ')}.` +
  ' To include them, add them to the `client.maxFilesPerFileCabinetFolder` config with a matching limit and remove their exclusion rules from the configuration file.'

export const toLargeTypesExcludedMessage = (updatedLargeTypes: string[]): string =>
  `The following types were excluded from the fetch as the elements of that type were too numerous: ${updatedLargeTypes.join(', ')}.` +
  " To include them, increase the types elements' size limitations and remove their exclusion rules."

export const ALIGNED_INACTIVE_CRITERIAS = 'The exclusion criteria of inactive elements was modified.'

export const toRemovedDeprecatedConfigsMessage = (paths: string[]): string =>
  `The following configs are deprecated and will be removed from the adapter config: ${paths.join(', ')}.`

const createFolderExclude = (folderPaths: NetsuiteFilePathsQueryParams): string[] =>
  folderPaths.map(folder => `^${_.escapeRegExp(folder)}.*`)

const createExclude = (
  failedPaths: NetsuiteFilePathsQueryParams = [],
  failedTypes: NetsuiteTypesQueryParams = {},
): QueryParams => ({
  fileCabinet: failedPaths.map(_.escapeRegExp),
  types: Object.entries(failedTypes).map(([name, ids]) => ({ name, ids })),
})

const toConfigSuggestions = ({
  failedToFetchAllAtOnce,
  failedFilePaths,
  failedTypes,
}: FetchByQueryFailures): NetsuiteConfig => {
  const config: NetsuiteConfig = {
    fetch: fullFetchConfig(),
  }

  if (!_.isEmpty(failedFilePaths.otherError) || !_.isEmpty(failedTypes.unexpectedError)) {
    config.fetch = {
      ...config.fetch,
      exclude: createExclude(failedFilePaths.otherError, failedTypes.unexpectedError),
    }
  }
  if (!_.isEmpty(failedFilePaths.lockedError) || !_.isEmpty(failedTypes.lockedError)) {
    config.fetch = {
      ...config.fetch,
      lockedElementsToExclude: createExclude(failedFilePaths.lockedError, failedTypes.lockedError),
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

const combineFetchTypeQueryParams = (
  first: FetchTypeQueryParams[],
  second: FetchTypeQueryParams[],
): FetchTypeQueryParams[] =>
  Object.entries(_.groupBy(first.concat(second), type => type.name)).flatMap(([name, types]) => {
    const [byCriteriaQueries, byIdsQueries] = _.partition(types, isCriteriaQuery)
    const combinedByIdsQuery =
      byIdsQueries.length > 0
        ? [
            {
              name,
              ...(byIdsQueries.some(type => type.ids === undefined)
                ? {}
                : { ids: _.uniq(byIdsQueries.flatMap(type => type.ids ?? [])) }),
            },
          ]
        : []
    const uniqByCriteriaQueries = _.uniqWith(byCriteriaQueries, _.isEqual)
    return [...combinedByIdsQuery, ...uniqByCriteriaQueries]
  })

const combineQueryParams = (first: QueryParams | undefined, second: QueryParams | undefined): QueryParams => {
  if (first === undefined || second === undefined) {
    return first ?? second ?? emptyQueryParams()
  }

  const newFileCabinet = _(first.fileCabinet).concat(second.fileCabinet).uniq().value()
  const newTypes = combineFetchTypeQueryParams(first.types, second.types)
  const newCustomRecords =
    first.customRecords || second.customRecords
      ? {
          customRecords: combineFetchTypeQueryParams(first.customRecords ?? [], second.customRecords ?? []),
        }
      : {}

  return {
    fileCabinet: newFileCabinet,
    types: newTypes,
    ...newCustomRecords,
  }
}

const updateConfigFromFailedFetch = (config: NetsuiteConfig, failures: FetchByQueryFailures): boolean => {
  const suggestions = toConfigSuggestions(failures)
  if (
    _.isEqual(suggestions, {
      fetch: fullFetchConfig(),
    })
  ) {
    return false
  }

  const { fetch: currentFetchConfig, client: currentClientConfig } = config
  const { fetch: suggestedFetchConfig, client: suggestedClientConfig } = suggestions

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
    suggestedFetchConfig?.lockedElementsToExclude,
  )

  if (!_.isEqual(newLockedElementToExclude, emptyQueryParams())) {
    updatedFetchConfig.lockedElementsToExclude = newLockedElementToExclude
  }

  config.fetch = updatedFetchConfig
  return true
}

const updateConfigFromLargeFolders = (
  config: NetsuiteConfig,
  largeFolderError: NetsuiteFilePathsQueryParams,
): NetsuiteFilePathsQueryParams => {
  if (largeFolderError && !_.isEmpty(largeFolderError)) {
    const largeFoldersToExclude = convertToQueryParams({ filePaths: createFolderExclude(largeFolderError) })
    config.fetch = {
      ...config.fetch,
      exclude: combineQueryParams(config.fetch.exclude, largeFoldersToExclude),
    }
    return largeFolderError
  }
  return []
}

const updateConfigFromLargeTypes = (
  config: NetsuiteConfig,
  { failedTypes, failedCustomRecords }: FetchByQueryFailures,
): string[] => {
  const { excludedTypes } = failedTypes
  if (!_.isEmpty(excludedTypes) || !_.isEmpty(failedCustomRecords)) {
    const customRecords = failedCustomRecords.map(type => ({ name: type }))
    const typesExcludeQuery = {
      fileCabinet: [],
      types: excludedTypes.map(type => ({ name: type })),
      ...(!_.isEmpty(customRecords) && { customRecords }),
    }
    config.fetch = {
      ...config.fetch,
      exclude: combineQueryParams(config.fetch.exclude, typesExcludeQuery),
    }
    return excludedTypes.concat(failedCustomRecords)
  }
  return []
}

// TODO: remove at May 24.
const alignInactiveExclusionCriterias = (config: NetsuiteConfig): boolean => {
  let isUpdated = false
  config.fetch.exclude.types.filter(isCriteriaQuery).forEach(item => {
    Object.values(INACTIVE_FIELDS).forEach(fieldName => {
      if (item.criteria[fieldName] !== undefined && fieldName !== INACTIVE_FIELDS.isInactive) {
        item.criteria[INACTIVE_FIELDS.isInactive] = item.criteria[fieldName]
        delete item.criteria[fieldName]
        isUpdated = true
      }
    })
  })
  config.fetch.exclude.types = _.uniqWith(config.fetch.exclude.types, _.isEqual)
  return isUpdated
}

const toConfigInstance = (config: NetsuiteConfig): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, configType, _.pickBy(config, values.isDefined))

const splitConfig = (config: NetsuiteConfig): InstanceElement[] => {
  const { lockedElementsToExclude, ...allFetchConfigExceptLockedElements } = config.fetch
  if (lockedElementsToExclude === undefined) {
    return [toConfigInstance(config)]
  }
  config.fetch = allFetchConfigExceptLockedElements
  const lockedElementsConfig: LockedElementsConfig = {
    fetch: {
      lockedElementsToExclude,
    },
  }
  return [
    toConfigInstance(config),
    new InstanceElement(ElemID.CONFIG_NAME, configType, lockedElementsConfig, ['lockedElements']),
  ]
}

const removeDeprecatedConfigs = (config: NetsuiteConfig): string[] => {
  const definedDeprecatedConfigs = DEPRECATED_CONFIGS_TO_REMOVE.filter(path => _.get(config, path) !== undefined)
  definedDeprecatedConfigs.forEach(path => _.unset(config, path))
  return definedDeprecatedConfigs
}

export const getConfigFromConfigChanges = (
  failures: FetchByQueryFailures,
  currentConfig: NetsuiteConfig,
): { config: InstanceElement[]; message: string } | undefined => {
  const config = _.cloneDeep(currentConfig)
  const didUpdateFromFailures = updateConfigFromFailedFetch(config, failures)
  const updatedLargeSizeFolders = updateConfigFromLargeFolders(config, failures.failedFilePaths.largeSizeFoldersError)
  const updatedLargeFilesCountFolders = updateConfigFromLargeFolders(
    config,
    failures.failedFilePaths.largeFilesCountFoldersError,
  )
  const updatedLargeTypes = updateConfigFromLargeTypes(config, failures)
  const alignedInactiveCriterias = alignInactiveExclusionCriterias(config)
  const removedDeprecatedConfigs = removeDeprecatedConfigs(config)

  const messages = [
    didUpdateFromFailures ? STOP_MANAGING_ITEMS_MSG : undefined,
    updatedLargeSizeFolders.length > 0 ? toLargeSizeFoldersExcludedMessage(updatedLargeSizeFolders) : undefined,
    updatedLargeFilesCountFolders.length > 0
      ? toLargeFilesCountFoldersExcludedMessage(updatedLargeFilesCountFolders)
      : undefined,
    updatedLargeTypes.length > 0 ? toLargeTypesExcludedMessage(updatedLargeTypes) : undefined,
    alignedInactiveCriterias ? ALIGNED_INACTIVE_CRITERIAS : undefined,
    removedDeprecatedConfigs.length > 0 ? toRemovedDeprecatedConfigsMessage(removedDeprecatedConfigs) : undefined,
  ].filter(values.isDefined)

  return messages.length > 0
    ? {
        config: splitConfig(config),
        message: formatConfigSuggestionsReasons(messages),
      }
    : undefined
}
