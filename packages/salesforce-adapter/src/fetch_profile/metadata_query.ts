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
import { DEFAULT_NAMESPACE, SETTINGS_METADATA_TYPE, TOPICS_FOR_OBJECTS_METADATA_TYPE, CUSTOM_OBJECT } from '../constants'
import { validateRegularExpressions } from '../config_validation'
import { MetadataInstance, MetadataParams, MetadataQueryParams } from '../types'

export type MetadataQuery = {
  isTypeMatch: (type: string) => boolean
  isInstanceMatch: (instance: MetadataInstance) => boolean
  isPartialFetch: () => boolean
}

const PERMANENT_SKIP_LIST: MetadataQueryParams[] = [
  // We have special treatment for this type
  { metadataType: 'CustomField' },
  { metadataType: SETTINGS_METADATA_TYPE },
  // Only has the active flow version but we cant get flow versions anyway
  { metadataType: 'FlowDefinition' },
  // readMetadata and retrieve fail on this type when fetching by name
  { metadataType: 'CustomIndex' },
  // readMetadata fails on those and pass on the parents
  // (AssignmentRules and EscalationRules)
  { metadataType: 'AssignmentRule' },
  { metadataType: 'EscalationRule' },
]

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
    const realNamespace = namespace === '' ? DEFAULT_NAMESPACE : namespace
    return new RegExp(`^${metadataType}$`).test(instance.metadataType)
    && new RegExp(`^${realNamespace}$`).test(instance.namespace)
    && new RegExp(`^${name}$`).test(instance.name)
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
      .forEach(([queryField, regex]) => {
        if (regex === undefined) {
          return
        }
        validateRegularExpressions([regex], [...fieldPath, queryField])
      })
  )
}

export const validateMetadataParams = (
  params: Partial<MetadataParams>,
  fieldPath: string[],
): void => {
  validateMetadataQueryParams(params.include ?? [], [...fieldPath, 'include'])
  validateMetadataQueryParams(params.exclude ?? [], [...fieldPath, 'include'])
}
