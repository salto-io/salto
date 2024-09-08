/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { fetch as fetchUtils } from '@salto-io/adapter-components'
import { ODATA_PREFIX } from './shared'

const { recursiveNestedTypeName } = fetchUtils.element

const toEntraTypeName = (typeName: string): string => `Entra${typeName}`

/* Fields */
export const APP_ROLE_ASSIGNMENT_FIELD_NAME = 'appRoleAssignments'
export const APP_ROLES_FIELD_NAME = 'appRoles'
export const AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME = 'authenticationMethodConfigurations'
export const CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME = 'allowedValues'
export const DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME = 'delegatedPermissionClassifications'
export const DOMAIN_NAME_REFERENCES_FIELD_NAME = 'domainNameReferences'
export const GROUP_ADDITIONAL_DATA_FIELD_NAME = 'additionalData'
export const GROUP_LIFE_CYCLE_POLICY_FIELD_NAME = 'lifeCyclePolicy'
export const IDENTIFIER_URIS_FIELD_NAME = 'identifierUris'
export const MEMBERS_FIELD_NAME = 'members'
export const PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME = 'preAuthorizedApplications'

/* Type names */
// Top level
export const ADMINISTRATIVE_UNIT_TYPE_NAME = toEntraTypeName('AdministrativeUnit')
export const APPLICATION_TYPE_NAME = toEntraTypeName('Application')
export const APP_ROLE_TYPE_NAME = toEntraTypeName('AppRole')
export const AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME = toEntraTypeName('AuthenticationStrengthPolicy')
export const AUTHENTICATION_METHOD_POLICY_TYPE_NAME = toEntraTypeName('AuthenticationMethodPolicy')
export const CLAIM_MAPPING_POLICY_TYPE_NAME = toEntraTypeName('ClaimMappingPolicy')
export const CONDITIONAL_ACCESS_POLICY_TYPE_NAME = toEntraTypeName('ConditionalAccessPolicy')
export const CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME = toEntraTypeName(
  'ConditionalAccessPolicyNamedLocation',
)
export const CROSS_TENANT_ACCESS_POLICY_TYPE_NAME = toEntraTypeName('CrossTenantAccessPolicy')
export const CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME = toEntraTypeName('CustomSecurityAttributeDefinition')
export const CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME = toEntraTypeName('CustomSecurityAttributeSet')
export const DOMAIN_TYPE_NAME = toEntraTypeName('Domain')
export const DIRECTORY_ROLE_TYPE_NAME = toEntraTypeName('DirectoryRole')
export const DIRECTORY_ROLE_TEMPLATE_TYPE_NAME = toEntraTypeName('DirectoryRoleTemplate')
export const GROUP_TYPE_NAME = toEntraTypeName('Group')
export const HOME_REALM_DISCOVERY_POLICY_TYPE_NAME = toEntraTypeName('HomeRealmDiscoveryPolicy')
export const LIFE_CYCLE_POLICY_TYPE_NAME = toEntraTypeName('GroupLifeCyclePolicy')
export const OAUTH2_PERMISSION_GRANT_TYPE_NAME = toEntraTypeName('Oauth2PermissionGrant')
export const PERMISSION_GRANT_POLICY_TYPE_NAME = toEntraTypeName('PermissionGrantPolicy')
export const ROLE_DEFINITION_TYPE_NAME = toEntraTypeName('RoleDefinition')
export const SERVICE_PRINCIPAL_TYPE_NAME = toEntraTypeName('ServicePrincipal')
export const TOKEN_LIFETIME_POLICY_TYPE_NAME = toEntraTypeName('TokenLifetimePolicy')

// Nested types
export const ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME = recursiveNestedTypeName(
  ADMINISTRATIVE_UNIT_TYPE_NAME,
  MEMBERS_FIELD_NAME,
)
export const APPLICATION_API_TYPE_NAME = recursiveNestedTypeName(APPLICATION_TYPE_NAME, 'api')
export const AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME = recursiveNestedTypeName(
  AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME,
)
export const CONDITIONAL_ACCESS_POLICY_CONDITIONS_TYPE_NAME = recursiveNestedTypeName(
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  'conditions',
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
  CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME,
)
export const DOMAIN_NAME_REFERENCE_TYPE_NAME = recursiveNestedTypeName(
  DOMAIN_TYPE_NAME,
  DOMAIN_NAME_REFERENCES_FIELD_NAME,
)
export const DIRECTORY_ROLE_MEMBERS_TYPE_NAME = recursiveNestedTypeName(DIRECTORY_ROLE_TYPE_NAME, MEMBERS_FIELD_NAME)
export const GROUP_ADDITIONAL_DATA_TYPE_NAME = recursiveNestedTypeName(
  GROUP_TYPE_NAME,
  GROUP_ADDITIONAL_DATA_FIELD_NAME,
)
export const GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME = recursiveNestedTypeName(
  GROUP_TYPE_NAME,
  APP_ROLE_ASSIGNMENT_FIELD_NAME,
)
export const GROUP_LIFE_CYCLE_POLICY_TYPE_NAME = recursiveNestedTypeName(
  GROUP_TYPE_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
)
export const SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME = recursiveNestedTypeName(
  SERVICE_PRINCIPAL_TYPE_NAME,
  APP_ROLE_ASSIGNMENT_FIELD_NAME,
)
export const DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME = recursiveNestedTypeName(
  SERVICE_PRINCIPAL_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME,
)

/* Microsoft Directory Objects - types mapping */
const SUPPORTED_DIRECTORY_OBJECTS_TYPE_NAME_TO_ODATA_TYPE_NAME: Record<string, string> = {
  [ADMINISTRATIVE_UNIT_TYPE_NAME]: `${ODATA_PREFIX}administrativeUnit`,
  [APPLICATION_TYPE_NAME]: `${ODATA_PREFIX}application`,
  [GROUP_TYPE_NAME]: `${ODATA_PREFIX}group`,
  [SERVICE_PRINCIPAL_TYPE_NAME]: `${ODATA_PREFIX}servicePrincipal`,
}

export const SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME: Record<string, string> = Object.entries(
  SUPPORTED_DIRECTORY_OBJECTS_TYPE_NAME_TO_ODATA_TYPE_NAME,
).reduce((acc, [typeName, odataType]) => ({ ...acc, [odataType]: typeName }), {})

/* Context keys */
// Values to that are added to the context of specific calls
export const CONTEXT_LIFE_CYCLE_POLICY_MANAGED_GROUP_TYPES = 'lifeCyclePolicyManagedGroupTypes'
