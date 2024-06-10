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
import { naclCase } from '@salto-io/adapter-utils'

export const ADAPTER_NAME = 'microsoft_entra'

// Fields
export const APP_ROLES_FIELD_NAME = 'appRoles'
export const AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME = 'authenticationMethodConfigurations'
export const CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME = 'allowedValues'
export const DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME = 'delegatedPermissionClassifications'
export const DOMAIN_NAME_REFERENCES_FIELD_NAME = 'domainNameReferences'
export const GROUP_ADDITIONAL_DATA_FIELD_NAME = 'additionalData'
export const APP_ROLE_ASSIGNMENT_FIELD_NAME = 'appRoleAssignments'
export const GROUP_LIFE_CYCLE_POLICY_FIELD_NAME = 'lifeCyclePolicy'
export const MEMBERS_FIELD_NAME = 'members'
export const TOKEN_ISSUANCE_POLICY_FIELD_NAME = 'tokenIssuancePolicies'

// Type names
export const ADMINISTRATIVE_UNIT_TYPE_NAME = 'administrativeUnit'
export const ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME = `${ADMINISTRATIVE_UNIT_TYPE_NAME}__${MEMBERS_FIELD_NAME}`
export const APPLICATION_TYPE_NAME = 'application'
export const AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME = 'authenticationStrengthPolicy'
export const AUTHENTICATION_METHOD_POLICY_TYPE_NAME = 'authenticationMethodPolicy'
export const AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME = `${AUTHENTICATION_METHOD_POLICY_TYPE_NAME}__${AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME}`
export const CLAIM_MAPPING_POLICY_TYPE_NAME = 'claimMappingPolicy'
export const CONDITIONAL_ACCESS_POLICY_TYPE_NAME = 'conditionalAccessPolicy'
export const CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME = 'conditionalAccessPolicyNamedLocation'
export const CROSS_TENANT_ACCESS_POLICY_TYPE_NAME = 'crossTenantAccessPolicy'
export const CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME = 'customSecurityAttributeDefinition'
export const CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME = `${CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME}__${CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME}`
export const CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME = 'customSecurityAttributeSet'
export const DOMAIN_TYPE_NAME = 'domain'
export const DOMAIN_NAME_REFERENCE_TYPE_NAME = `${DOMAIN_TYPE_NAME}__${DOMAIN_NAME_REFERENCES_FIELD_NAME}`
export const DIRECTORY_ROLE_TYPE_NAME = 'directoryRole'
export const DIRECTORY_ROLE_TEMPLATE_TYPE_NAME = 'directoryRoleTemplate'
export const DIRECTORY_ROLE_MEMBERS_TYPE_NAME = `${DIRECTORY_ROLE_TYPE_NAME}__${MEMBERS_FIELD_NAME}`
export const GROUP_TYPE_NAME = 'group'
export const GROUP_ADDITIONAL_DATA_TYPE_NAME = `${GROUP_TYPE_NAME}__${GROUP_ADDITIONAL_DATA_FIELD_NAME}`
export const GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME = `${GROUP_TYPE_NAME}__${APP_ROLE_ASSIGNMENT_FIELD_NAME}`
export const GROUP_LIFE_CYCLE_POLICY_TYPE_NAME = `${GROUP_TYPE_NAME}__${GROUP_LIFE_CYCLE_POLICY_FIELD_NAME}`
export const HOME_REALM_DISCOVERY_POLICY_TYPE_NAME = 'homeRealmDiscoveryPolicy'
export const LIFE_CYCLE_POLICY_TYPE_NAME = 'groupLifeCyclePolicy'
export const OAUTH2_PERMISSION_GRANT_TYPE_NAME = 'oauth2PermissionGrant'
export const PERMISSION_GRANT_POLICY_TYPE_NAME = 'permissionGrantPolicy'
export const ROLE_DEFINITION_TYPE_NAME = 'roleDefinition'
export const SERVICE_PRINCIPAL_TYPE_NAME = 'servicePrincipal'
export const SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME = `${SERVICE_PRINCIPAL_TYPE_NAME}__${APP_ROLE_ASSIGNMENT_FIELD_NAME}`
export const DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME = `${SERVICE_PRINCIPAL_TYPE_NAME}__${DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME}`
export const TOKEN_ISSUANCE_POLICY_TYPE_NAME = `${APPLICATION_TYPE_NAME}__${TOKEN_ISSUANCE_POLICY_FIELD_NAME}`
export const TOKEN_LIFETIME_POLICY_TYPE_NAME = 'tokenLifetimePolicy'

// OData fields
export const ODATA_TYPE_FIELD = '@odata.type'
export const ODATA_TYPE_FIELD_NACL_CASE = naclCase(ODATA_TYPE_FIELD)

export const ODATA_PREFIX = '#microsoft.graph.'
export const SUPPORTED_DIRECTORY_OBJECT_TYPE_NAME_TO_ODATA_TYPE_NAME: Record<string, string> = {
  [ADMINISTRATIVE_UNIT_TYPE_NAME]: `${ODATA_PREFIX}administrativeUnit`,
  [APPLICATION_TYPE_NAME]: `${ODATA_PREFIX}application`,
  [GROUP_TYPE_NAME]: `${ODATA_PREFIX}group`,
  [SERVICE_PRINCIPAL_TYPE_NAME]: `${ODATA_PREFIX}servicePrincipal`,
}

export const SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME: Record<string, string> = Object.entries(
  SUPPORTED_DIRECTORY_OBJECT_TYPE_NAME_TO_ODATA_TYPE_NAME,
).reduce((acc, [typeName, odataType]) => ({ ...acc, [odataType]: typeName }), {})
