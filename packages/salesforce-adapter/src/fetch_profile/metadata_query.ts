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
import { SETTINGS_METADATA_TYPE } from '../constants'
import { ConfigValidationError, validateRegularExpressions } from '../config_validation'
import { MetadataInstance, MetadataParams, MetadataQueryParams, METADATA_CONFIG } from '../types'

export type MetadataQuery = {
  isTypeMatch: (type: string) => boolean
  isInstanceMatch: (instance: MetadataInstance) => boolean
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

export const buildMetadataQuery = ({ include = [{}], exclude = [] }: MetadataParams):
  MetadataQuery => {
  const fullExcludeList = [...exclude, ...PERMANENT_SKIP_LIST]

  const isInstanceMatchQueryParams = (
    instance: MetadataInstance,
    {
      metadataType = '.*',
      namespace = '.*',
      name = '.*',
    }: MetadataQueryParams
  ): boolean =>
    new RegExp(`^${metadataType}$`).test(instance.metadataType)
    && new RegExp(`^${namespace}$`).test(instance.namespace)
    && new RegExp(`^${name}$`).test(instance.name)

  return {
    isTypeMatch: type => (
      include.some(({ metadataType = '.*' }) => new RegExp(`^${metadataType}$`).test(type))
      && !fullExcludeList.some(({ metadataType = '.*', namespace = '.*', name = '.*' }) =>
        namespace === '.*' && name === '.*' && new RegExp(`^${metadataType}$`).test(type))
    ),

    isInstanceMatch: instance => (
      include.some(params => isInstanceMatchQueryParams(instance, params))
      && !fullExcludeList.some(params => isInstanceMatchQueryParams(instance, params))
    ),
  }
}

const validateMetadataQueryParams = (field: string, params: MetadataQueryParams[]): void => {
  params.forEach(
    queryParams => Object.entries(queryParams)
      .forEach(([queryField, regex]) => {
        if (regex === undefined) {
          return
        }
        try {
          validateRegularExpressions([regex])
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            e.fieldPath.unshift(METADATA_CONFIG, field, queryField)
          }
          throw e
        }
      })
  )
}

export const validateMetadataParams = (params: Partial<MetadataParams>): void => {
  validateMetadataQueryParams('include', params.include ?? [])
  validateMetadataQueryParams('exclude', params.exclude ?? [])
}
