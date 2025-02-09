/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections, regex, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { FileProperties } from '@salto-io/jsforce'
import { logger } from '@salto-io/logging'
import { inspectValue, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  CUSTOM_OBJECT,
  DEFAULT_NAMESPACE,
  MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD,
  SETTINGS_METADATA_TYPE,
} from '../constants'
import { ConfigValidationError, validateRegularExpressions } from '../config_validation'
import {
  FetchParameters,
  LastChangeDateOfTypesWithNestedInstances,
  METADATA_EXCLUDE_LIST,
  METADATA_INCLUDE_LIST,
  METADATA_SEPARATE_FIELD_LIST,
  MetadataInstance,
  MetadataParams,
  MetadataQuery,
  MetadataQueryParams,
  TypeWithNestedInstances,
  TypeWithNestedInstancesPerParent,
} from '../types'
import { getChangedAtSingletonInstance } from '../filters/utils'
import {
  isTypeWithNestedInstances,
  isTypeWithNestedInstancesPerParent,
  NESTED_TYPE_TO_PARENT_TYPE,
} from '../last_change_date_of_types_with_nested_instances'
import { includesSettingsTypes } from './metadata_types'
import { isFeatureEnabled } from './optional_features'

const { makeArray } = collections.array
const { isDefined } = values
const log = logger(module)

// According to Salesforce Metadata API docs, folder names can only contain alphanumeric characters and underscores.
const VALID_FOLDER_PATH_RE = /^[a-zA-Z\d_/]+$/

const PERMANENT_SKIP_LIST: MetadataQueryParams[] = [
  // We have special treatment for this type
  { metadataType: 'CustomField' },
  // readMetadata and retrieve fail on this type when fetching by name
  { metadataType: 'CustomIndex' },
  // readMetadata fails on those and pass on the parents
  // (AssignmentRules and EscalationRules)
  { metadataType: 'AssignmentRule' },
  { metadataType: 'EscalationRule' },
  // May conflict with the MetadataType ForecastingCategoryMapping
  { metadataType: 'CustomObject', name: 'ForecastingCategoryMapping' },
]

// Instances of these types will match all namespaces
// and not just standard if '' (aka default) is provided in the namespace filter
const DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST = ['InstalledPackage']

const getDefaultNamespace = (metadataType: string): string =>
  DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST.includes(metadataType) ? '.*' : DEFAULT_NAMESPACE

const getPaths = (regexString: string): string[] =>
  regexString
    .replace(/[()^$]/g, '')
    .split('|')
    .filter(path => VALID_FOLDER_PATH_RE.test(path))

// Since fullPaths are provided for nested Folder names, a special handling is required
const isFolderMetadataTypeNameMatch = ({ name: instanceName }: MetadataInstance, name: string): boolean =>
  getPaths(name).some(path => path.endsWith(instanceName)) || regex.isFullRegexMatch(instanceName, name)

type BuildMetadataQueryParams = {
  fetchParams: FetchParameters
  targetedFetchInclude?: MetadataQueryParams[]
}

type BuildFetchWithChangesDetectionMetadataQueryParams = BuildMetadataQueryParams & {
  elementsSource: ReadOnlyElementsSource
  lastChangeDateOfTypesWithNestedInstances: LastChangeDateOfTypesWithNestedInstances
  customObjectsWithDeletedFields: Set<string>
}

export const buildMetadataQuery = ({ fetchParams, targetedFetchInclude }: BuildMetadataQueryParams): MetadataQuery => {
  const metadata = fetchParams.metadata ?? {}
  if (targetedFetchInclude !== undefined) {
    log.debug('targeted fetch include is: %s', inspectValue(targetedFetchInclude))
  }
  const fullExcludeList: MetadataQueryParams[] = [
    ...(metadata.exclude ?? []),
    ...PERMANENT_SKIP_LIST,
    ...makeArray(
      isFeatureEnabled('retrieveSettings', fetchParams.optionalFeatures)
        ? undefined
        : { metadataType: SETTINGS_METADATA_TYPE },
    ),
  ]

  const isTypeIncludedInTargetedFetch = (type: string): boolean => {
    if (targetedFetchInclude === undefined) {
      return true
    }
    return targetedFetchInclude.some(({ metadataType = '.*' }) => new RegExp(`^${metadataType}$`).test(type))
  }

  const include = metadata.include
    ? metadata.include.concat(
        isFeatureEnabled('retrieveSettings', fetchParams.optionalFeatures) &&
          includesSettingsTypes(metadata.include.map(({ metadataType }) => metadataType).filter(isDefined) ?? [])
          ? [{ metadataType: SETTINGS_METADATA_TYPE }]
          : [],
      )
    : [{}]
  const isTypeIncluded = (type: string): boolean =>
    include.some(({ metadataType = '.*' }) =>
      new RegExp(`^${metadataType}$`).test(NESTED_TYPE_TO_PARENT_TYPE[type] ?? type),
    ) && isTypeIncludedInTargetedFetch(type)

  const isTypeExcluded = (type: string): boolean =>
    fullExcludeList.some(
      ({ metadataType = '.*', namespace = '.*', name = '.*' }) =>
        namespace === '.*' &&
        name === '.*' &&
        new RegExp(`^${metadataType}$`).test(NESTED_TYPE_TO_PARENT_TYPE[type] ?? type),
    )

  const fixSettingsType = (metadataType: string, name: string): string =>
    isFeatureEnabled('retrieveSettings', fetchParams.optionalFeatures) && metadataType === SETTINGS_METADATA_TYPE
      ? name.concat(SETTINGS_METADATA_TYPE)
      : metadataType

  const isInstanceMatchQueryParams = (
    instance: MetadataInstance,
    { metadataType = '.*', namespace = '.*', name = '.*' }: MetadataQueryParams,
  ): boolean => {
    const instanceMetadataType = fixSettingsType(
      NESTED_TYPE_TO_PARENT_TYPE[instance.metadataType] ?? instance.metadataType,
      instance.name,
    )
    const realNamespace = namespace === '' ? getDefaultNamespace(instanceMetadataType) : namespace
    if (
      !regex.isFullRegexMatch(instanceMetadataType, metadataType) ||
      !regex.isFullRegexMatch(instance.namespace, realNamespace)
    ) {
      return false
    }
    return instance.isFolderType
      ? isFolderMetadataTypeNameMatch(instance, name)
      : regex.isFullRegexMatch(instance.name, name)
  }

  const isInstanceIncludedInTargetedFetch = (instance: MetadataInstance): boolean => {
    if (targetedFetchInclude === undefined) {
      return true
    }
    return targetedFetchInclude.some(params => isInstanceMatchQueryParams(instance, params))
  }
  const isInstanceIncluded = (instance: MetadataInstance): boolean =>
    include.some(params => isInstanceMatchQueryParams(instance, params)) &&
    isInstanceIncludedInTargetedFetch(instance) &&
    !fullExcludeList.some(params => isInstanceMatchQueryParams(instance, params))
  const isTargetedFetch = (): boolean => fetchParams.target !== undefined
  return {
    isTypeMatch: type => isTypeIncluded(type) && !isTypeExcluded(type),
    isTargetedFetch,
    isInstanceIncluded,
    isInstanceMatch: isInstanceIncluded,
    isFetchWithChangesDetection: () => false,
    isPartialFetch: isTargetedFetch,
    getFolderPathsByName: (folderType: string) => {
      const folderPaths = include
        .filter(params => params.metadataType === folderType)
        .flatMap(params => {
          const { name: nameRegex } = params
          return isDefined(nameRegex) ? getPaths(nameRegex) : []
        })
      return _.keyBy(folderPaths, path => _.last(path.split('/')) ?? path)
    },
    logData: () => ({}),
  }
}

const isValidDateString = (dateString: string | undefined): dateString is string =>
  dateString !== undefined && dateString !== ''

export const buildMetadataQueryForFetchWithChangesDetection = async (
  params: BuildFetchWithChangesDetectionMetadataQueryParams,
): Promise<MetadataQuery> => {
  const { elementsSource, lastChangeDateOfTypesWithNestedInstances } = params
  const changedAtSingleton = await getChangedAtSingletonInstance(elementsSource)
  if (changedAtSingleton === undefined) {
    throw new Error('First fetch does not support changes detection')
  }
  const { value: singletonValues } = changedAtSingleton
  const lastChangeDateOfTypesWithNestedInstancesFromSingleton: LastChangeDateOfTypesWithNestedInstances = {
    AssignmentRules: singletonValues.AssignmentRules ?? {},
    AutoResponseRules: singletonValues.AutoResponseRules ?? {},
    CustomObject: singletonValues.CustomObject ?? {},
    EscalationRules: singletonValues.EscalationRules ?? {},
    SharingRules: singletonValues.SharingRules ?? {},
    Workflow: singletonValues.Workflow ?? {},
    CustomLabels: singletonValues.CustomLabels,
  }
  const metadataQuery = buildMetadataQuery(params)
  const isInstanceWithNestedInstancesIncluded = (type: TypeWithNestedInstances): boolean => {
    const dateFromSingleton = lastChangeDateOfTypesWithNestedInstancesFromSingleton[type]
    const lastChangeDate = lastChangeDateOfTypesWithNestedInstances[type]
    return isValidDateString(dateFromSingleton) && isValidDateString(lastChangeDate)
      ? new Date(dateFromSingleton).getTime() < new Date(lastChangeDate).getTime()
      : true
  }

  const isInstanceWithNestedInstancesPerParentIncluded = (
    type: TypeWithNestedInstancesPerParent,
    instanceName: string,
  ): boolean => {
    const parentName = instanceName.split('.')[0]
    const dateFromSingleton = lastChangeDateOfTypesWithNestedInstancesFromSingleton[type][parentName]
    const lastChangeDate = lastChangeDateOfTypesWithNestedInstances[type][parentName]
    if (parentName === 'Parent') {
      log.debug('lastChangeDate of Parent: %s', lastChangeDate)
    }
    // Standard Objects with no CustomFields and sub instances will have no lastChangeDate
    if (lastChangeDate === undefined) {
      return false
    }
    return isValidDateString(dateFromSingleton) && isValidDateString(lastChangeDate)
      ? new Date(dateFromSingleton).getTime() < new Date(lastChangeDate).getTime()
      : true
  }

  const missingOrInvalidChangedAtInstances: MetadataInstance[] = []
  const updatedInstances: (MetadataInstance & {
    changedAtFromSingleton: string | undefined
  })[] = []

  const isIncludedInFetchWithChangesDetection = (instance: MetadataInstance): boolean => {
    const dateFromSingleton = _.get(singletonValues, [instance.metadataType, instance.name])
    if (!(isValidDateString(dateFromSingleton) && isValidDateString(instance.changedAt))) {
      missingOrInvalidChangedAtInstances.push(instance)
      return true
    }
    if (new Date(dateFromSingleton).getTime() < new Date(instance.changedAt).getTime()) {
      log.trace('The instance %s of type %s will be fetched since it was updated', instance.name, instance.metadataType)
      updatedInstances.push({
        ...instance,
        changedAtFromSingleton: dateFromSingleton,
      })
      return true
    }
    return false
  }
  return {
    ...metadataQuery,
    isPartialFetch: () => true,
    isFetchWithChangesDetection: () => true,
    isInstanceMatch: instance => {
      if (!metadataQuery.isInstanceIncluded(instance)) {
        return false
      }
      const { metadataType, name } = instance
      if (metadataType === CUSTOM_OBJECT && params.customObjectsWithDeletedFields.has(name)) {
        return true
      }
      if (isTypeWithNestedInstances(metadataType)) {
        return isInstanceWithNestedInstancesIncluded(metadataType)
      }
      if (isTypeWithNestedInstancesPerParent(metadataType)) {
        return isInstanceWithNestedInstancesPerParentIncluded(metadataType, name)
      }
      return isIncludedInFetchWithChangesDetection(instance)
    },
    logData: () => {
      ;(updatedInstances.length > 100 ? log.trace : log.debug)(
        'The following instances were fetched in fetch with changes detection since they were updated: %s',
        safeJsonStringify(updatedInstances),
      )
      ;(missingOrInvalidChangedAtInstances.length > 100 ? log.trace : log.debug)(
        'The following instances were fetched in fetch with changes detection due to invalid or missing changedAt: %s',
        safeJsonStringify(missingOrInvalidChangedAtInstances),
      )
      if (params.customObjectsWithDeletedFields.size > 0) {
        log.debug(
          'The following custom objects have deleted fields and were fetched in fetch with changes detection: %s',
          Array.from(params.customObjectsWithDeletedFields),
        )
      }
    },
  }
}

const validateMetadataQueryParams = (params: MetadataQueryParams[], fieldPath: string[]): void => {
  if (!Array.isArray(params)) {
    const errMessage = `Metadata query parameters must be a list, got: ${inspectValue(params)}`
    throw new ConfigValidationError(fieldPath, errMessage)
  }

  params.forEach(queryParams =>
    Object.entries(queryParams).forEach(([queryField, pattern]) => {
      if (pattern === undefined) {
        return
      }
      validateRegularExpressions([pattern], [...fieldPath, queryField])
    }),
  )
}

export const validateMetadataParams = (params: Partial<MetadataParams>, fieldPath: string[]): void => {
  validateMetadataQueryParams(params.include ?? [], [...fieldPath, METADATA_INCLUDE_LIST])
  validateMetadataQueryParams(params.exclude ?? [], [...fieldPath, METADATA_EXCLUDE_LIST])

  if (
    params.objectsToSeperateFieldsToFiles !== undefined &&
    params.objectsToSeperateFieldsToFiles.length > MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD
  ) {
    throw new ConfigValidationError(
      [...fieldPath, METADATA_SEPARATE_FIELD_LIST],
      `${METADATA_SEPARATE_FIELD_LIST} should not be larger than ${MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD}. current length is ${params.objectsToSeperateFieldsToFiles.length}`,
    )
  }
}

export const buildFilePropsMetadataQuery = (metadataQuery: MetadataQuery): MetadataQuery<FileProperties> => {
  const filePropsToMetadataInstance = ({
    namespacePrefix,
    type: metadataType,
    fullName: name,
    lastModifiedDate: changedAt,
  }: FileProperties): MetadataInstance => ({
    namespace: namespacePrefix === undefined || namespacePrefix === '' ? DEFAULT_NAMESPACE : namespacePrefix,
    metadataType,
    name,
    changedAt,
    isFolderType: false,
  })
  return {
    ...metadataQuery,
    isInstanceIncluded: instance => metadataQuery.isInstanceIncluded(filePropsToMetadataInstance(instance)),
    isInstanceMatch: instance => metadataQuery.isInstanceMatch(filePropsToMetadataInstance(instance)),
  }
}
