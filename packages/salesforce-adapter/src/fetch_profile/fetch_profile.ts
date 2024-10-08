/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { buildDataManagement, validateDataManagementConfig } from './data_management'
import { buildMetadataQuery, validateMetadataParams } from './metadata_query'
import { DEFAULT_MAX_INSTANCES_PER_TYPE, DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST } from '../constants'
import { mergeWithDefaultImportantValues } from './important_values'
import { customReferencesConfiguration } from '../custom_references/handlers'

type OptionalFeaturesDefaultValues = {
  [FeatureName in keyof OptionalFeatures]?: boolean
}

const PREFER_ACTIVE_FLOW_VERSIONS_DEFAULT = false

const optionalFeaturesDefaultValues: OptionalFeaturesDefaultValues = {
  fetchProfilesUsingReadApi: false,
  generateRefsInProfiles: false,
  skipAliases: false,
  toolingDepsOfCurrentNamespace: false,
  extraDependenciesV2: true,
  extendedCustomFieldInformation: false,
  importantValues: true,
  hideTypesFolder: true,
  omitStandardFieldsNonDeployableValues: true,
  metaTypes: false,
  cpqRulesAndConditionsRefs: true,
  flowCoordinates: false,
  improvedDataBrokenReferences: false,
  taskAndEventCustomFields: false,
  sharingRulesMaps: false,
  excludeNonRetrievedProfilesRelatedInstances: true,
  waveMetadataSupport: false,
  indexedEmailTemplateAttachments: false,
  skipParsingXmlNumbers: false,
  logDiffsFromParsingXmlNumbers: true,
  performSideEffectDeletes: false,
  extendTriggersMetadata: false,
  removeReferenceFromFilterItemToRecordType: false,
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
    limits,
    additionalImportantValues,
  } = fetchParams
  const enabledCustomReferencesHandlers = customReferencesConfiguration(customReferencesSettings)
  return {
    dataManagement: data && buildDataManagement(data),
    isFeatureEnabled: name => optionalFeatures?.[name] ?? optionalFeaturesDefaultValues[name] ?? true,
    isCustomReferencesHandlerEnabled: name => enabledCustomReferencesHandlers[name] ?? false,
    shouldFetchAllCustomSettings: () => fetchAllCustomSettings ?? true,
    maxInstancesPerType: maxInstancesPerType ?? DEFAULT_MAX_INSTANCES_PER_TYPE,
    preferActiveFlowVersions: preferActiveFlowVersions ?? PREFER_ACTIVE_FLOW_VERSIONS_DEFAULT,
    addNamespacePrefixToFullName: addNamespacePrefixToFullName ?? true,
    isWarningEnabled: name => warningSettings?.[name] ?? true,
    metadataQuery,
    maxItemsInRetrieveRequest,
    importantValues: mergeWithDefaultImportantValues(additionalImportantValues),
    limits,
  }
}

export const validateFetchParameters = (params: Partial<FetchParameters>, fieldPath: string[]): void => {
  validateMetadataParams(params.metadata ?? {}, [...fieldPath, METADATA_CONFIG])

  if (params.data !== undefined) {
    validateDataManagementConfig(params.data, [...fieldPath, DATA_CONFIGURATION])
  }
  if (params.additionalImportantValues !== undefined) {
    const duplicateDefs = _(params.additionalImportantValues)
      .groupBy(def => def.value)
      .filter((defs, _value) => defs.length > 1)
      .keys()
      .value()
    if (duplicateDefs.length > 0) {
      throw new Error(`Duplicate definitions for additionalImportantValues: [${duplicateDefs.join(', ')}]`)
    }
  }
}
