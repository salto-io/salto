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
import { definitions, config as configUtils } from '@salto-io/adapter-components'

export type IdLocator = {
  fieldRegex: string
  idRegex: string
  type: string[]
}

export type Themes = {
  brands?: string[]
  referenceOptions: {
    enableReferenceLookup: boolean
    javascriptReferenceLookupStrategy?:
      | {
          strategy: 'numericValues'
          minimumDigitAmount: number
        }
      | {
          strategy: 'varNamePrefix'
          prefix: string
        }
  }
}

export type Guide = {
  brands: string[]
  themes?: Themes
  // Deprecated
  themesForBrands?: string[]
}

export type OmitInactiveConfig = definitions.DefaultWithCustomizations<boolean>

export type ZendeskFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: definitions.DefaultFetchCriteria
}> & {
  enableMissingReferences?: boolean
  includeAuditDetails?: boolean
  addAlias?: boolean
  handleIdenticalAttachmentConflicts?: boolean
  greedyAppReferences?: boolean
  appReferenceLocators?: IdLocator[]
  guide?: Guide
  resolveOrganizationIDs?: boolean
  resolveUserIDs?: boolean
  extractReferencesFromFreeText?: boolean
  convertJsonIdsToReferences?: boolean
  omitInactive?: OmitInactiveConfig
  omitTicketStatusTicketField?: boolean
  useNewInfra?: boolean
}

export type ZendeskClientRateLimitConfig = definitions.ClientRateLimitConfig & { rateLimitBuffer?: number }

export type ZendeskClientConfig = definitions.ClientBaseConfig<ZendeskClientRateLimitConfig> & {
  unassociatedAttachmentChunkSize: number
}

export type ZendeskDeployConfig = definitions.UserDeployConfig &
  definitions.DefaultMissingUserFallbackConfig & {
    createMissingOrganizations?: boolean
  }

export type ZendeskApiConfig = configUtils.AdapterApiConfig<
  configUtils.DuckTypeTransformationConfig,
  configUtils.TransformationDefaultConfig
>

export type ZendeskUserConfig = definitions.UserConfig<
  never,
  ZendeskClientConfig,
  ZendeskFetchConfig,
  ZendeskDeployConfig
>
