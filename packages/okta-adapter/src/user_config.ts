/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements, definitions } from '@salto-io/adapter-components'
import { BuiltinTypes, CORE_ANNOTATIONS, InstanceElement, createRestriction } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { JWK_TYPE_NAME, OKTA, USER_TYPE_NAME } from './constants'

const log = logger(module)

type GetUsersStrategy = 'searchQuery' | 'allUsers'

export type OktaUserFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: definitions.DefaultFetchCriteria
}> & {
  isClassicOrg?: boolean
  convertUsersIds?: boolean
  enableMissingReferences?: boolean
  includeGroupMemberships?: boolean
  includeProfileMappingProperties?: boolean
  getUsersStrategy?: GetUsersStrategy
  maxUsersResults?: number
}

export type OktaClientRateLimitConfig = definitions.ClientRateLimitConfig & { rateLimitBuffer?: number }

export type OktaClientConfig = definitions.ClientBaseConfig<OktaClientRateLimitConfig> & {
  usePrivateAPI: boolean
}

export type OktaUserDeployConfig = definitions.UserDeployConfig & { omitMissingUsers?: boolean }

export type OktaUserConfig = definitions.UserConfig<never, OktaClientConfig, OktaUserFetchConfig, OktaUserDeployConfig>

const changeValidatorNames = [
  'createCheckDeploymentBasedOnConfig',
  'createCheckDeploymentBasedOnDefinitions',
  'appGroup',
  'groupRuleStatus',
  'groupRuleActions',
  'defaultPolicies',
  'customApplicationStatus',
  'userTypeAndSchema',
  'appIntegrationSetup',
  'assignedAccessPolicies',
  'enabledAuthenticators',
  'users',
  'appUserSchemaWithInactiveApp',
  'appWithGroupPush',
  'groupPushToApplicationUniqueness',
  'appGroupAssignment',
  'appUrls',
  'profileMappingRemoval',
  'brandRemoval',
  'dynamicOSVersion',
  'brandDependentElementRemoval',
  'appUserSchemaRemoval',
  'domainAddition',
  'domainModification',
  'schemaBaseChanges',
  'userStatusChanges',
  'disabledAuthenticatorsInMfaPolicy',
  'oidcIdentityProvider',
  'everyoneGroupAssignments',
  'emailDomainAddition',
] as const

export type ChangeValidatorName = (typeof changeValidatorNames)[number]

// default config values
export const DEFAULT_CONVERT_USERS_IDS_VALUE = true
export const DEFAULT_GET_USERS_STRATEGY = 'searchQuery'
const DEFAULT_INCLUDE_PROFILE_MAPPING_PROPERTIES = false
const DEFAULT_APP_URLS_VALIDATOR_VALUE = false

export const DEFAULT_CONFIG: OktaUserConfig = {
  client: {
    usePrivateAPI: true,
  },
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    exclude: [{ type: USER_TYPE_NAME }, { type: JWK_TYPE_NAME }],
    hideTypes: true,
    convertUsersIds: DEFAULT_CONVERT_USERS_IDS_VALUE,
    enableMissingReferences: true,
    includeGroupMemberships: false,
    includeProfileMappingProperties: DEFAULT_INCLUDE_PROFILE_MAPPING_PROPERTIES,
    getUsersStrategy: DEFAULT_GET_USERS_STRATEGY,
  },
  deploy: {
    changeValidators: {
      appUrls: DEFAULT_APP_URLS_VALIDATOR_VALUE,
    },
  },
}

const additionalFetchConfigFields = {
  convertUsersIds: { refType: BuiltinTypes.BOOLEAN },
  enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
  includeGroupMemberships: { refType: BuiltinTypes.BOOLEAN },
  includeProfileMappingProperties: { refType: BuiltinTypes.BOOLEAN },
  getUsersStrategy: {
    refType: BuiltinTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['searchQuery', 'allUsers'] }),
    },
  },
  isClassicOrg: { refType: BuiltinTypes.BOOLEAN },
  maxUsersResults: { refType: BuiltinTypes.NUMBER },
}

export const configType = definitions.createUserConfigType({
  adapterName: OKTA,
  defaultConfig: DEFAULT_CONFIG,
  changeValidatorNames: [...changeValidatorNames],
  additionalFetchFields: additionalFetchConfigFields,
  additionalDeployFields: { omitMissingUsers: { refType: BuiltinTypes.BOOLEAN } },
  additionRateLimitFields: { rateLimitBuffer: { refType: BuiltinTypes.NUMBER } },
  additionalClientFields: {
    usePrivateAPI: { refType: BuiltinTypes.BOOLEAN },
  },
  omitElemID: false,
  pathsToOmitFromDefaultConfig: ['fetch.enableMissingReferences', 'fetch.getUsersStrategy'],
})

/*
 * Temporary config suggestion to migrate existing configs to exclude JWK type
 */
export const getExcludeJWKConfigSuggestion = (
  userConfig: Readonly<InstanceElement> | undefined,
): definitions.ConfigChangeSuggestion | undefined => {
  const typesToExclude = userConfig?.value?.fetch?.exclude
  const typesToInclude = userConfig?.value?.fetch?.include
  if (!Array.isArray(typesToExclude) || !Array.isArray(typesToInclude)) {
    log.error(
      'failed creating config suggestion to exclude JsonWebKey type, expected fetch.exclude and fetch.include to be an array, but instead got %s',
      safeJsonStringify({ exclude: typesToExclude, include: typesToInclude }),
    )
    return undefined
  }
  const isJWKExcluded = typesToExclude.find(fetchEnty => fetchEnty?.type === JWK_TYPE_NAME)
  const isJWKIncluded = typesToInclude.find(fetchEnty => fetchEnty?.type === JWK_TYPE_NAME)
  if (!isJWKExcluded && !isJWKIncluded) {
    return {
      type: 'typeToExclude',
      value: JWK_TYPE_NAME,
      reason:
        'JsonWebKey type is excluded by default. To include it, explicitly add "JsonWebKey" type into the include list.',
    }
  }
  return undefined
}
