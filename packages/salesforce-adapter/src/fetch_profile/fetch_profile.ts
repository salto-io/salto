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

import { DATA_CONFIGURATION, FetchParameters, METADATA_CONFIG, OptionalFeatures } from '../types'
import { buildDataManagement, DataManagement, validateDataManagementConfig } from './data_management'
import { buildMetadataQuery, MetadataQuery, validateMetadataParams } from './metadata_query'
import { DEFAULT_MAX_INSTANCES_PER_TYPE } from '../constants'


export type FetchProfile = {
  readonly metadataQuery: MetadataQuery
  readonly dataManagement?: DataManagement
  readonly isFeatureEnabled: (name: keyof OptionalFeatures) => boolean
  readonly shouldFetchAllCustomSettings: () => boolean
  readonly maxInstancesPerType: number
  readonly preferActiveFlowVersions: boolean

}

export const buildFetchProfile = ({
  metadata = {},
  data,
  fetchAllCustomSettings,
  optionalFeatures,
  target,
  maxInstancesPerType,
  preferActiveFlowVersions,
}: FetchParameters): FetchProfile => ({
  metadataQuery: buildMetadataQuery(metadata, target),
  dataManagement: data && buildDataManagement(data),
  isFeatureEnabled: name => optionalFeatures?.[name] ?? true,
  shouldFetchAllCustomSettings: () => fetchAllCustomSettings ?? true,
  maxInstancesPerType: maxInstancesPerType ?? DEFAULT_MAX_INSTANCES_PER_TYPE,
  preferActiveFlowVersions: preferActiveFlowVersions ?? false,
})

export const validateFetchParameters = (
  params: Partial<FetchParameters>,
  fieldPath: string[]
): void => {
  validateMetadataParams(params.metadata ?? {}, [...fieldPath, METADATA_CONFIG])

  if (params.data !== undefined) {
    validateDataManagementConfig(params.data, [...fieldPath, DATA_CONFIGURATION])
  }
}
