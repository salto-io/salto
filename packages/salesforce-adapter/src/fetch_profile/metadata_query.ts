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
import { regex, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { FileProperties } from '@salto-io/jsforce'
import {
  CUSTOM_FIELD,
  CUSTOM_METADATA,
  CUSTOM_OBJECT,
  DEFAULT_NAMESPACE,
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD,
  PROFILE_METADATA_TYPE,
  SETTINGS_METADATA_TYPE,
  TOPICS_FOR_OBJECTS_METADATA_TYPE,
} from '../constants'
import { ConfigValidationError, validateRegularExpressions } from '../config_validation'
import {
  FetchParameters,
  METADATA_EXCLUDE_LIST,
  METADATA_INCLUDE_LIST,
  METADATA_SEPARATE_FIELD_LIST,
  MetadataInstance,
  MetadataParams,
  MetadataQuery,
  MetadataQueryParams,
} from '../types'
import { getChangedAtSingleton, getTypeChangedAt } from '../filters/utils'

const { isDefined } = values


// According to Salesforce Metadata API docs, folder names can only contain alphanumeric characters and underscores.
const VALID_FOLDER_PATH_RE = /^[a-zA-Z\d_/]+$/

const PERMANENT_SKIP_LIST: MetadataQueryParams[] = [
  // We have special treatment for this type
  { metadataType: 'CustomField' },
  { metadataType: SETTINGS_METADATA_TYPE },
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
const DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST = [
  'InstalledPackage',
]


// Instances of this type won't be fetched in fetchWithChangesDetection mode
const UNSUPPORTED_FETCH_WITH_CHANGES_DETECTION_TYPES = [
  PROFILE_METADATA_TYPE,
  CUSTOM_OBJECT,
  // Since we don't retrieve the CustomMetadata types (CustomObjects), we shouldn't retrieve the Records
  CUSTOM_METADATA,
  CUSTOM_FIELD,
]

const getDefaultNamespace = (metadataType: string): string =>
  (DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST.includes(metadataType)
    ? '.*'
    : DEFAULT_NAMESPACE)

const getPaths = (regexString: string): string[] => (
  regexString
    .replace(/[()^$]/g, '')
    .split('|')
    .filter(path => VALID_FOLDER_PATH_RE.test(path))
)

// Since fullPaths are provided for nested Folder names, a special handling is required
const isFolderMetadataTypeNameMatch = ({ name: instanceName }: MetadataInstance, name: string): boolean => (
  getPaths(name)
    .some(path => path.endsWith(instanceName))
  || regex.isFullRegexMatch(instanceName, name)
)

type BuildMetadataQueryParams = {
  fetchParams: FetchParameters
}

type BuildFetchWithChangesDetectionMetadataQueryParams = BuildMetadataQueryParams & {
  elementsSource: ReadOnlyElementsSource
}

export const buildMetadataQuery = ({ fetchParams }: BuildMetadataQueryParams): MetadataQuery => {
  const {
    metadata = {},
    target,
  } = fetchParams
  const { include = [{}], exclude = [] } = metadata
  const fullExcludeList = [...exclude, ...PERMANENT_SKIP_LIST]

  const isIncludedInPartialFetch = (type: string): boolean => {
    if (target === undefined) {
      return true
    }
    if (target.includes(type)) {
      return true
    }
    if (type === TOPICS_FOR_OBJECTS_METADATA_TYPE && target.includes(CUSTOM_OBJECT)) {
      return true
    }
    // We should really do this only when config.preferActiveFlowVersions is true
    // if you have another use-case to pass the config here also handle this please
    if (type === FLOW_DEFINITION_METADATA_TYPE && target.includes(FLOW_METADATA_TYPE)) {
      return true
    }
    return false
  }

  const isTypeIncluded = (type: string): boolean => (
    include.some(({ metadataType = '.*' }) => new RegExp(`^${metadataType}$`).test(type))
    && isIncludedInPartialFetch(type)
  )
  const isTypeExcluded = (type: string): boolean => (
    fullExcludeList.some(({ metadataType = '.*', namespace = '.*', name = '.*' }) => (
      namespace === '.*' && name === '.*' && new RegExp(`^${metadataType}$`).test(type)
    ))
  )
  const isInstanceMatchQueryParams = (
    instance: MetadataInstance,
    {
      metadataType = '.*',
      namespace = '.*',
      name = '.*',
    }: MetadataQueryParams
  ): boolean => {
    const realNamespace = namespace === ''
      ? getDefaultNamespace(instance.metadataType)
      : namespace
    if (!regex.isFullRegexMatch(instance.metadataType, metadataType)
      || !regex.isFullRegexMatch(instance.namespace, realNamespace)) {
      return false
    }
    return instance.isFolderType
      ? isFolderMetadataTypeNameMatch(instance, name)
      : regex.isFullRegexMatch(instance.name, name)
  }

  const isInstanceIncluded = (instance: MetadataInstance): boolean => (
    include.some(params => isInstanceMatchQueryParams(instance, params))
    && !fullExcludeList.some(params => isInstanceMatchQueryParams(instance, params))
  )
  const isTargetedFetch = (): boolean => target !== undefined
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
          return isDefined(nameRegex)
            ? getPaths(nameRegex)
            : []
        })
      return _.keyBy(folderPaths, path => _.last(path.split('/')) ?? path)
    },
  }
}

export const buildMetadataQueryForFetchWithChangesDetection = async (
  params: BuildFetchWithChangesDetectionMetadataQueryParams
): Promise<MetadataQuery> => {
  const changedAtSingleton = await getChangedAtSingleton(params.elementsSource)
  if (changedAtSingleton === undefined) {
    throw new Error('First fetch does not support changes detection')
  }
  const metadataQuery = buildMetadataQuery(params)
  const isIncludedInFetchWithChangesDetection = (instance: MetadataInstance): boolean => {
    if (instance.changedAt === undefined) {
      return true
    }
    const lastChangedAt = getTypeChangedAt(changedAtSingleton, instance.metadataType, instance.name)
    return _.isString(lastChangedAt)
      ? new Date(lastChangedAt).getTime() < new Date(instance.changedAt).getTime()
      : true
  }
  return {
    ...metadataQuery,
    isTypeMatch: (type: string) => (
      metadataQuery.isTypeMatch(type)
      && !UNSUPPORTED_FETCH_WITH_CHANGES_DETECTION_TYPES.includes(type)
    ),
    isPartialFetch: () => true,
    isFetchWithChangesDetection: () => true,
    isInstanceMatch: instance => (
      metadataQuery.isInstanceIncluded(instance) && isIncludedInFetchWithChangesDetection(instance)
    ),
  }
}

const validateMetadataQueryParams = (params: MetadataQueryParams[], fieldPath: string[]): void => {
  params.forEach(
    queryParams => Object.entries(queryParams)
      .forEach(([queryField, pattern]) => {
        if (pattern === undefined) {
          return
        }
        validateRegularExpressions([pattern], [...fieldPath, queryField])
      })
  )
}

export const validateMetadataParams = (
  params: Partial<MetadataParams>,
  fieldPath: string[],
): void => {
  validateMetadataQueryParams(params.include ?? [], [...fieldPath, METADATA_INCLUDE_LIST])
  validateMetadataQueryParams(params.exclude ?? [], [...fieldPath, METADATA_EXCLUDE_LIST])

  if (params.objectsToSeperateFieldsToFiles !== undefined
    && params.objectsToSeperateFieldsToFiles.length > MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD) {
    throw new ConfigValidationError(
      [...fieldPath, METADATA_SEPARATE_FIELD_LIST],
      `${METADATA_SEPARATE_FIELD_LIST} should not be larger than ${MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD}. current length is ${params.objectsToSeperateFieldsToFiles.length}`
    )
  }
}

export const buildFilePropsMetadataQuery = (
  metadataQuery: MetadataQuery
): MetadataQuery<FileProperties> => {
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
