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
import { regex } from '@salto-io/lowerdash'
import { DEFAULT_NAMESPACE, SETTINGS_METADATA_TYPE, TOPICS_FOR_OBJECTS_METADATA_TYPE, CUSTOM_OBJECT, MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD, FLOW_DEFINITION_METADATA_TYPE, FLOW_METADATA_TYPE } from '../constants'
import { validateRegularExpressions, ConfigValidationError } from '../config_validation'
import { MetadataInstance, MetadataParams, MetadataQueryParams, METADATA_INCLUDE_LIST, METADATA_EXCLUDE_LIST, METADATA_SEPARATE_FIELD_LIST } from '../types'

export type MetadataQuery = {
  isTypeMatch: (type: string) => boolean
  isInstanceMatch: (instance: MetadataInstance) => boolean
  isPartialFetch: () => boolean
}

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
]

// Instances of these types will match all namespaces
// and not just standard if '' (aka default) is provided in the namespace filter
const DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST = [
  'InstalledPackage',
]

const getDefaultNamespace = (metadataType: string): string =>
  (DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST.includes(metadataType)
    ? '.*'
    : DEFAULT_NAMESPACE)

export const buildMetadataQuery = (
  { include = [{}], exclude = [] }: MetadataParams,
  target?: string[],
): MetadataQuery => {
  const fullExcludeList = [...exclude, ...PERMANENT_SKIP_LIST]

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
    return regex.isFullRegexMatch(instance.metadataType, metadataType)
    && regex.isFullRegexMatch(instance.namespace, realNamespace)
    && regex.isFullRegexMatch(instance.name, name)
  }

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

  return {
    isTypeMatch: type => isTypeIncluded(type) && !isTypeExcluded(type),

    isInstanceMatch: instance => (
      include.some(params => isInstanceMatchQueryParams(instance, params))
      && !fullExcludeList.some(params => isInstanceMatchQueryParams(instance, params))
    ),

    isPartialFetch: () => target !== undefined,
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
