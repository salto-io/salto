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

import { convertDeprecatedDataConf, convertDeprecatedMetadataParams } from '../config_change'
import { ConfigValidationError } from '../config_validation'
import { DATA_CONFIGURATION, DeprecatedFetchParameters, FetchParameters, METADATA_CONFIG } from '../types'
import { buildDataManagement, DataManagement, validateDataManagementConfig } from './data_management'
import { buildMetadataQuery, MetadataQuery, validateMetadataParams } from './metadata_query'


export type FetchProfile = {
  readonly metadataQuery: MetadataQuery
  readonly dataManagement?: DataManagement
}

export const buildFetchProfile = ({
  metadata = {},
  data,
}: FetchParameters, deprecatedParams?: DeprecatedFetchParameters): FetchProfile => {
  const dataManagementParameters = data ?? (
    deprecatedParams?.dataManagement && convertDeprecatedDataConf(deprecatedParams.dataManagement)
  )

  const metadataParameters = deprecatedParams !== undefined
    ? convertDeprecatedMetadataParams(metadata, deprecatedParams)
    : metadata

  return {
    metadataQuery: buildMetadataQuery(metadataParameters),
    dataManagement: dataManagementParameters && buildDataManagement(dataManagementParameters),
  }
}

export const validateFetchParameters = (params: Partial<FetchParameters>): void => {
  try {
    validateMetadataParams(params.metadata ?? {})
  } catch (e) {
    if (e instanceof ConfigValidationError) {
      e.fieldPath.unshift(METADATA_CONFIG)
    }
    throw e
  }
  if (params.data !== undefined) {
    try {
      validateDataManagementConfig(params.data)
    } catch (e) {
      if (e instanceof ConfigValidationError) {
        e.fieldPath.unshift(DATA_CONFIGURATION)
      }
      throw e
    }
  }
}
