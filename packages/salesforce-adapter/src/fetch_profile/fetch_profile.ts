/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { values } from '@salto-io/lowerdash'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import {
  DATA_CONFIGURATION,
  FetchParameters,
  FetchProfile,
  METADATA_CONFIG,
  OptionalFeatures,
  LastChangeDateOfTypesWithNestedInstances,
} from '../types'
import { buildDataManagement, validateDataManagementConfig } from './data_management'
import { buildMetadataQuery, validateMetadataParams } from './metadata_query'
import { DEFAULT_MAX_INSTANCES_PER_TYPE } from '../constants'
import { getFetchTargets, SupportedMetadataType } from './metadata_types'
import { getChangedAtSingleton } from '../filters/utils'

const { isDefined } = values

type OptionalFeaturesDefaultValues = {
  [FeatureName in keyof OptionalFeatures]?: boolean
}

const optionalFeaturesDefaultValues: OptionalFeaturesDefaultValues = {
  fetchProfilesUsingReadApi: false,
  generateRefsInProfiles: false,
  skipAliases: false,
  toolingDepsOfCurrentNamespace: false,
  fixRetrieveFilePaths: true,
}

type BuildFetchProfileParams = {
  fetchParams: FetchParameters
  elementsSource: ReadOnlyElementsSource
}

type BaseFetchProfile = Omit<FetchProfile, 'metadataQuery'>

const buildBaseFetchProfile = ({
  fetchParams,
}: BuildFetchProfileParams): BaseFetchProfile => {
  const {
    data,
    fetchAllCustomSettings,
    optionalFeatures,
    maxInstancesPerType,
    preferActiveFlowVersions,
    addNamespacePrefixToFullName,
    warningSettings,
  } = fetchParams
  return {
    dataManagement: data && buildDataManagement(data),
    isFeatureEnabled: name => optionalFeatures?.[name] ?? optionalFeaturesDefaultValues[name] ?? true,
    shouldFetchAllCustomSettings: () => fetchAllCustomSettings ?? true,
    maxInstancesPerType: maxInstancesPerType ?? DEFAULT_MAX_INSTANCES_PER_TYPE,
    preferActiveFlowVersions: preferActiveFlowVersions ?? false,
    addNamespacePrefixToFullName: addNamespacePrefixToFullName ?? true,
    isWarningEnabled: name => (
      warningSettings?.[name] ?? true
    ),
  }
}

export const buildFetchProfile = (params: BuildFetchProfileParams): FetchProfile => {
  const {
    metadata = {},
    target,
  } = params.fetchParams
  return {
    ...buildBaseFetchProfile(params),
    metadataQuery: buildMetadataQuery({
      metadataParams: metadata,
      isFetchWithChangesDetection: false,
      target: isDefined(target)
        ? getFetchTargets(target as SupportedMetadataType[])
        : undefined,
    }),
  }
}

export const buildFetchProfileForFetchWithChangesDetection = async (
  params: BuildFetchProfileParams & {
    lastChangeDateOfTypesWithNestedInstancesPromise: Promise<LastChangeDateOfTypesWithNestedInstances>
  }
): Promise<FetchProfile> => {
  const {
    metadata = {},
    target,
  } = params.fetchParams
  return {
    ...buildBaseFetchProfile(params),
    metadataQuery: buildMetadataQuery({
      metadataParams: metadata,
      isFetchWithChangesDetection: true,
      target: isDefined(target)
        ? getFetchTargets(target as SupportedMetadataType[])
        : undefined,
      changedAtSingleton: await getChangedAtSingleton(params.elementsSource),
      lastChangeDateOfTypesWithNestedInstances: await params.lastChangeDateOfTypesWithNestedInstancesPromise,
    }),
  }
}

export const validateFetchParameters = (
  params: Partial<FetchParameters>,
  fieldPath: string[]
): void => {
  validateMetadataParams(params.metadata ?? {}, [...fieldPath, METADATA_CONFIG])

  if (params.data !== undefined) {
    validateDataManagementConfig(params.data, [...fieldPath, DATA_CONFIGURATION])
  }
}
