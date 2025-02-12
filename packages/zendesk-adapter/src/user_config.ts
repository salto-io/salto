/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
    javascriptReferenceLookupStrategy?: {
      strategy: 'numericValues' | 'varNamePrefix'
      minimumDigitAmount?: number
      prefix?: string
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
  useGuideNewInfra?: boolean
  translationBodyAsStaticFile?: boolean
  fetchBotBuilder?: boolean
}

type ZendeskClientRateLimitConfig = definitions.ClientRateLimitConfig & { rateLimitBuffer?: number }

export type ZendeskClientConfig = definitions.ClientBaseConfig<ZendeskClientRateLimitConfig> & {
  unassociatedAttachmentChunkSize: number
}

export type ZendeskDeployConfig = definitions.UserDeployConfig &
  definitions.DefaultMissingUserFallbackConfig & {
    createMissingOrganizations?: boolean
  }

export const fixerNames = [
  'mergeLists',
  'fallbackUsers',
  'removeDupUsers',
  'orderElements',
  'deployArticlesAsDraft',
  'fixTicketForms',
] as const

type FixerNames = (typeof fixerNames)[number]

export type ZendeskFixElementsConfig = Record<FixerNames, boolean>

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
