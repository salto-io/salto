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
import _ from 'lodash'
import {
  DATA_CONFIGURATION,
  FetchProfile,
  FetchParameters,
  METADATA_CONFIG,
  OptionalFeatures,
  MetadataQuery,
  CustomReferencesSettings,
} from '../types'
import {
  buildDataManagement,
  validateDataManagementConfig,
} from './data_management'
import { buildMetadataQuery, validateMetadataParams } from './metadata_query'
import {
  DEFAULT_MAX_INSTANCES_PER_TYPE,
  DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
} from '../constants'
import { mergeWithDefaultImportantValues } from './important_values'
import { customReferencesConfiguration } from '../custom_references/handlers'

type OptionalFeaturesDefaultValues = {
  [FeatureName in keyof OptionalFeatures]?: boolean
}

const optionalFeaturesDefaultValues: OptionalFeaturesDefaultValues = {
  fetchProfilesUsingReadApi: false,
  generateRefsInProfiles: false,
  skipAliases: false,
  toolingDepsOfCurrentNamespace: false,
  fixRetrieveFilePaths: true,
  extraDependenciesV2: true,
  extendedCustomFieldInformation: false,
  importantValues: true,
  hideTypesFolder: false,
  omitStandardFieldsNonDeployableValues: true,
  latestSupportedApiVersion: false,
}

type BuildFetchProfileParams = {
  fetchParams: FetchParameters
  customReferencesSettings?: CustomReferencesSettings
  metadataQuery?: MetadataQuery
  maxItemsInRetrieveRequest?: number
}

export const buildFetchProfile = ({
  fetchParams,
  customReferencesSettings,
  metadataQuery = buildMetadataQuery({ fetchParams }),
  maxItemsInRetrieveRequest = DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
}: BuildFetchProfileParams): FetchProfile => {
  const {
    data,
    fetchAllCustomSettings,
    optionalFeatures,
    maxInstancesPerType,
    preferActiveFlowVersions,
    addNamespacePrefixToFullName,
    warningSettings,
    additionalImportantValues,
  } = fetchParams
  const enabledCustomReferencesHandlers = customReferencesConfiguration(
    customReferencesSettings,
  )
  return {
    dataManagement: data && buildDataManagement(data),
    isFeatureEnabled: (name) =>
      optionalFeatures?.[name] ?? optionalFeaturesDefaultValues[name] ?? true,
    isCustomReferencesHandlerEnabled: (name) =>
      enabledCustomReferencesHandlers[name] ?? false,
    shouldFetchAllCustomSettings: () => fetchAllCustomSettings ?? true,
    maxInstancesPerType: maxInstancesPerType ?? DEFAULT_MAX_INSTANCES_PER_TYPE,
    preferActiveFlowVersions: preferActiveFlowVersions ?? false,
    addNamespacePrefixToFullName: addNamespacePrefixToFullName ?? true,
    isWarningEnabled: (name) => warningSettings?.[name] ?? true,
    metadataQuery,
    maxItemsInRetrieveRequest,
    importantValues: mergeWithDefaultImportantValues(additionalImportantValues),
  }
}

export const validateFetchParameters = (
  params: Partial<FetchParameters>,
  fieldPath: string[],
): void => {
  validateMetadataParams(params.metadata ?? {}, [...fieldPath, METADATA_CONFIG])

  if (params.data !== undefined) {
    validateDataManagementConfig(params.data, [
      ...fieldPath,
      DATA_CONFIGURATION,
    ])
  }
  if (params.additionalImportantValues !== undefined) {
    const duplicateDefs = _(params.additionalImportantValues)
      .groupBy((def) => def.value)
      .filter((defs, _value) => defs.length > 1)
      .keys()
      .value()
    if (duplicateDefs.length > 0) {
      throw new Error(
        `Duplicate definitions for additionalImportantValues: [${duplicateDefs.join(', ')}]`,
      )
    }
  }
}
