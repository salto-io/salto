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

import { ClientRateLimitConfig, ClientRetryConfig, UserDeployConfig } from '@salto-io/adapter-components/src/definitions'
import { ImportantValues } from '@salto-io/adapter-utils'
import { MetadataParams, DataManagementConfig, WarningSettings, CLIENT_CONFIG, DEPLOY_CONFIG, ClientPollingConfig, ClientDeployConfig, CustomObjectsDeployRetryConfig, ReadMetadataChunkSizeConfig, MAX_ITEMS_IN_RETRIEVE_REQUEST } from './types'

export const CPQ_MANAGED_PACKAGE = 'sbaa, SBQQ (CPQ)'

export const MANAGED_PACKAGES = [CPQ_MANAGED_PACKAGE] as const

export type ManagedPackage = (typeof MANAGED_PACKAGES)[number]

export type SalesforceClientConfig = Partial<{
  polling: ClientPollingConfig
  deploy: ClientDeployConfig
  maxConcurrentApiRequests: ClientRateLimitConfig
  retry: ClientRetryConfig
  dataRetry: CustomObjectsDeployRetryConfig
  readMetadataChunkSize: ReadMetadataChunkSizeConfig
  [MAX_ITEMS_IN_RETRIEVE_REQUEST]: number
}>


export type OptionalFeatures = {
  extraDependencies?: boolean
  extraDependenciesV2?: boolean
  elementsUrls?: boolean
  profilePaths?: boolean
  addMissingIds?: boolean
  authorInformation?: boolean
  describeSObjects?: boolean
  skipAliases?: boolean
  formulaDeps?: boolean
  fetchCustomObjectUsingRetrieveApi?: boolean
  generateRefsInProfiles?: boolean
  fetchProfilesUsingReadApi?: boolean
  toolingDepsOfCurrentNamespace?: boolean
  useLabelAsAlias?: boolean
  fixRetrieveFilePaths?: boolean
  organizationWideSharingDefaults?: boolean
  extendedCustomFieldInformation?: boolean
  importantValues?: boolean
  hideTypesFolder?: boolean
  fetchAllCustomSettings?: boolean
  addNamespacePrefixToFullName?: boolean
  preferActiveFlowVersions?: boolean
  enumFieldPermissions?: boolean
}


export type FetchParameters = {
  metadata?: MetadataParams
  data?: DataManagementConfig
}

export type GeneralFetchParameters = FetchParameters & {
  optionalFeatures?: OptionalFeatures
  target?: string[] 
  maxInstancesPerType?: number
  warningSettings?: WarningSettings
  additionalImportantValues?: ImportantValues
}

export type SalesforceConfig = {
  generalSettings: GeneralFetchParameters
  [CLIENT_CONFIG]?: SalesforceClientConfig
  [DEPLOY_CONFIG]?: UserDeployConfig
} &  { [key in ManagedPackage]: FetchParameters }

