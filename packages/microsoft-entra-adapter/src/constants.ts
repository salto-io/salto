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
export const ADAPTER_NAME = 'microsoft_entra'

// Fields
export const AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME = 'authenticationMethodConfigurations'
export const GROUP_ADDITIONAL_DATA_FIELD_NAME = 'additionalData'
export const GROUP_APP_ROLE_ASSIGNMENT_FIELD_NAME = 'appRoleAssignments'
export const GROUP_LIFE_CYCLE_POLICY_FIELD_NAME = 'lifeCyclePolicies'
export const TOKEN_ISSUANCE_POLICY_FIELD_NAME = 'tokenIssuancePolicies'

// Type names
export const APPLICATION_TYPE_NAME = 'application'
export const AUTHENTICATION_METHOD_POLICY_TYPE_NAME = 'authenticationMethodPolicy'
export const AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME = `${AUTHENTICATION_METHOD_POLICY_TYPE_NAME}__${AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME}`
export const CLAIM_MAPPING_POLICY_TYPE_NAME = 'claimMappingPolicy'
export const CONDITIONAL_ACCESS_POLICY_TYPE_NAME = 'conditionalAccessPolicy'
export const CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME = 'customSecurityAttributeAllowedValues'
export const DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME = 'delegatedPermissionClassification'
export const GROUP_TYPE_NAME = 'group'
export const GROUP_ADDITIONAL_DATA_TYPE_NAME = `${GROUP_TYPE_NAME}__${GROUP_ADDITIONAL_DATA_FIELD_NAME}`
export const GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME = `${GROUP_TYPE_NAME}__${GROUP_APP_ROLE_ASSIGNMENT_FIELD_NAME}`
export const GROUP_LIFE_CYCLE_POLICY_TYPE_NAME = `${GROUP_TYPE_NAME}__${GROUP_LIFE_CYCLE_POLICY_FIELD_NAME}`
export const HOME_REALM_DISCOVERY_POLICY_TYPE_NAME = 'homeRealmDiscoveryPolicy'
export const LIFE_CYCLE_POLICY_TYPE_NAME = 'groupLifeCyclePolicy'
export const OAUTH2_PERMISSION_GRANT_TYPE_NAME = 'oauth2PermissionGrant'
export const ROLE_DEFINITION_TYPE_NAME = 'roleDefinition'
export const SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME = 'servicePrincipalAppRoleAssignment'
export const SERVICE_PRINCIPAL_TYPE_NAME = 'servicePrincipal'
export const TOKEN_ISSUANCE_POLICY_TYPE_NAME = `${APPLICATION_TYPE_NAME}__${TOKEN_ISSUANCE_POLICY_FIELD_NAME}`
export const TOKEN_LIFETIME_POLICY_TYPE_NAME = 'tokenLifetimePolicy'
