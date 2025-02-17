/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { fetch as fetchUtils } from '@salto-io/adapter-components'
import { ODATA_PREFIX } from './shared'

const { recursiveNestedTypeName } = fetchUtils.element

type EntraTypeName = `Entra${string}`

export const SERVICE_BASE_URL = 'https://entra.microsoft.com'

/* Fields */
export const API_FIELD_NAME = 'api'
export const APP_ROLE_ASSIGNMENT_FIELD_NAME = 'appRoleAssignments'
export const APP_ROLES_FIELD_NAME = 'appRoles'
export const AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME = 'authenticationMethodConfigurations'
export const CONDITIONS_FIELD_NAME = 'conditions'
export const CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME = 'allowedValues'
export const DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME = 'delegatedPermissionClassifications'
export const DELEGATED_PERMISSION_IDS_FIELD_NAME = 'delegatedPermissionIds'
export const DOMAIN_NAME_REFERENCES_FIELD_NAME = 'domainNameReferences'
export const GROUP_ADDITIONAL_DATA_FIELD_NAME = 'additionalData'
export const GROUP_LIFE_CYCLE_POLICY_FIELD_NAME = 'lifeCyclePolicy'
export const IDENTIFIER_URIS_FIELD_NAME = 'identifierUris'
export const MEMBERS_FIELD_NAME = 'members'
export const PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME = 'preAuthorizedApplications'
export const REQUIRED_RESOURCE_ACCESS_FIELD_NAME = 'requiredResourceAccess'
export const OAUTH2_PERMISSION_SCOPES_FIELD_NAME = 'oauth2PermissionScopes'

export const CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS = [
  'includeApplications',
  'excludeApplications',
  'includeServicePrincipals',
  'excludeServicePrincipals',
  'includeUsers',
  'excludeUsers',
  'includeGroups',
  'excludeGroups',
  'includeRoles',
  'excludeRoles',
  'includeDevices',
  'excludeDevices',
] as const

// Paths to fields
export const AUTHENTICATION_STRENGTH_PATH = ['grantControls', 'authenticationStrength']

/* Type names */
// Top level
export const TOP_LEVEL_TYPES = {
  ADMINISTRATIVE_UNIT_TYPE_NAME: 'EntraAdministrativeUnit',
  APPLICATION_TYPE_NAME: 'EntraApplication',
  APP_ROLE_TYPE_NAME: 'EntraAppRole',
  AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME: 'EntraAuthenticationStrengthPolicy',
  AUTHENTICATION_METHOD_POLICY_TYPE_NAME: 'EntraAuthenticationMethodPolicy',
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME: 'EntraConditionalAccessPolicy',
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME: 'EntraConditionalAccessPolicyNamedLocation',
  CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME: 'EntraCustomSecurityAttributeDefinition',
  CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME: 'EntraCustomSecurityAttributeSet',
  DOMAIN_TYPE_NAME: 'EntraDomain',
  DIRECTORY_ROLE_TYPE_NAME: 'EntraDirectoryRole',
  DIRECTORY_ROLE_TEMPLATE_TYPE_NAME: 'EntraDirectoryRoleTemplate',
  GROUP_TYPE_NAME: 'EntraGroup',
  LIFE_CYCLE_POLICY_TYPE_NAME: 'EntraGroupLifeCyclePolicy',
  OAUTH2_PERMISSION_GRANT_TYPE_NAME: 'EntraOauth2PermissionGrant',
  OAUTH2_PERMISSION_SCOPE_TYPE_NAME: 'EntraOauth2PermissionScope',
  PERMISSION_GRANT_POLICY_TYPE_NAME: 'EntraPermissionGrantPolicy',
  ROLE_DEFINITION_TYPE_NAME: 'EntraRoleDefinition',
  SERVICE_PRINCIPAL_TYPE_NAME: 'EntraServicePrincipal',
} as const

// This anonymous function is only used for compile time validation.
// Once we upgrade to TS 4.9 or newer we can use the new `satisfies` syntax instead.
;(<T extends Record<string, EntraTypeName>>(_value: T): void => {})(TOP_LEVEL_TYPES)

// Nested types
export const ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.ADMINISTRATIVE_UNIT_TYPE_NAME,
  MEMBERS_FIELD_NAME,
)
export const APPLICATION_API_TYPE_NAME = recursiveNestedTypeName(TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME, API_FIELD_NAME)
export const AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME,
)
const CONDITIONAL_ACCESS_POLICY_CONDITIONS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  CONDITIONS_FIELD_NAME,
)
export const CONDITIONAL_ACCESS_POLICY_CONDITION_LOCATIONS_TYPE_NAME = recursiveNestedTypeName(
  CONDITIONAL_ACCESS_POLICY_CONDITIONS_TYPE_NAME,
  'locations',
)
export const CONDITIONAL_ACCESS_POLICY_CONDITION_APPLICATIONS_TYPE_NAME = recursiveNestedTypeName(
  CONDITIONAL_ACCESS_POLICY_CONDITIONS_TYPE_NAME,
  'applications',
)
export const CONDITIONAL_ACCESS_POLICY_CONDITION_USERS_TYPE_NAME = recursiveNestedTypeName(
  CONDITIONAL_ACCESS_POLICY_CONDITIONS_TYPE_NAME,
  'users',
)
export const CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME,
)
export const DOMAIN_NAME_REFERENCE_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.DOMAIN_TYPE_NAME,
  DOMAIN_NAME_REFERENCES_FIELD_NAME,
)
export const DIRECTORY_ROLE_MEMBERS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.DIRECTORY_ROLE_TYPE_NAME,
  MEMBERS_FIELD_NAME,
)
export const GROUP_ADDITIONAL_DATA_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.GROUP_TYPE_NAME,
  GROUP_ADDITIONAL_DATA_FIELD_NAME,
)
export const GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.GROUP_TYPE_NAME,
  APP_ROLE_ASSIGNMENT_FIELD_NAME,
)
export const GROUP_LIFE_CYCLE_POLICY_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.GROUP_TYPE_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
)
export const SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.SERVICE_PRINCIPAL_TYPE_NAME,
  APP_ROLE_ASSIGNMENT_FIELD_NAME,
)
export const DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.SERVICE_PRINCIPAL_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME,
)

/* Microsoft Directory Objects - types mapping */
const SUPPORTED_DIRECTORY_OBJECTS_TYPE_NAME_TO_ODATA_TYPE_NAME: Record<string, string> = {
  [TOP_LEVEL_TYPES.ADMINISTRATIVE_UNIT_TYPE_NAME]: `${ODATA_PREFIX}administrativeUnit`,
  [TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME]: `${ODATA_PREFIX}application`,
  [TOP_LEVEL_TYPES.GROUP_TYPE_NAME]: `${ODATA_PREFIX}group`,
  [TOP_LEVEL_TYPES.SERVICE_PRINCIPAL_TYPE_NAME]: `${ODATA_PREFIX}servicePrincipal`,
}

export const SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME: Record<string, string> = Object.entries(
  SUPPORTED_DIRECTORY_OBJECTS_TYPE_NAME_TO_ODATA_TYPE_NAME,
).reduce((acc, [typeName, odataType]) => ({ ...acc, [odataType]: typeName }), {})

/* Context keys */
// Values to that are added to the context of specific calls
export const CONTEXT_LIFE_CYCLE_POLICY_MANAGED_GROUP_TYPES = 'lifeCyclePolicyManagedGroupTypes'
