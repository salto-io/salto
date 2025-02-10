/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const OKTA = 'okta'
export const APPLICATION_TYPE_NAME = 'Application'
export const APP_GROUP_ASSIGNMENT_TYPE_NAME = 'ApplicationGroupAssignment'
export const GROUP_TYPE_NAME = 'Group'
export const GROUP_RULE_TYPE_NAME = 'GroupRule'
export const IDENTITY_PROVIDER_TYPE_NAME = 'IdentityProvider'
export const USERTYPE_TYPE_NAME = 'UserType'
export const FEATURE_TYPE_NAME = 'Feature'
export const NETWORK_ZONE_TYPE_NAME = 'NetworkZone'
export const ROLE_TYPE_NAME = 'Role'
export const USER_SCHEMA_TYPE_NAME = 'UserSchema'
export const INLINE_HOOK_TYPE_NAME = 'InlineHook'
export const AUTHENTICATOR_TYPE_NAME = 'Authenticator'
export const BEHAVIOR_RULE_TYPE_NAME = 'BehaviorRule'
export const ORG_SETTING_TYPE_NAME = 'OrgSetting'
export const AUTHORIZATION_SERVER = 'AuthorizationServer'
export const ACCESS_POLICY_TYPE_NAME = 'AccessPolicy'
export const IDP_POLICY_TYPE_NAME = 'IdentityProviderPolicy'
export const MFA_POLICY_TYPE_NAME = 'MultifactorEnrollmentPolicy'
export const SIGN_ON_POLICY_TYPE_NAME = 'OktaSignOnPolicy'
export const PASSWORD_POLICY_TYPE_NAME = 'PasswordPolicy'
export const PROFILE_ENROLLMENT_POLICY_TYPE_NAME = 'ProfileEnrollmentPolicy'
export const AUTHORIZATION_POLICY = 'AuthorizationServerPolicy'
export const ACCESS_POLICY_RULE_TYPE_NAME = 'AccessPolicyRule'
export const PROFILE_ENROLLMENT_RULE_TYPE_NAME = 'ProfileEnrollmentPolicyRule'
export const IDP_RULE_TYPE_NAME = 'IdentityProviderPolicyRule'
export const MFA_RULE_TYPE_NAME = 'MultifactorEnrollmentPolicyRule'
export const SIGN_ON_RULE_TYPE_NAME = 'OktaSignOnPolicyRule'
export const PASSWORD_RULE_TYPE_NAME = 'PasswordPolicyRule'
export const AUTHORIZATION_POLICY_RULE = 'AuthorizationServerPolicyRule'
export const ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME = 'AccessPolicyRulePriority'
export const AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME = 'AuthorizationServerPolicyRulePriority'
export const IDP_RULE_PRIORITY_TYPE_NAME = 'IdentityProviderPolicyRulePriority'
export const MFA_RULE_PRIORITY_TYPE_NAME = 'MultifactorEnrollmentPolicyRulePriority'
export const SIGN_ON_RULE_PRIORITY_TYPE_NAME = 'OktaSignOnPolicyRulePriority'
export const PASSWORD_RULE_PRIORITY_TYPE_NAME = 'PasswordPolicyRulePriority'
export const SIGN_ON_POLICY_PRIORITY_TYPE_NAME = 'OktaSignOnPolicyPriority'
export const MFA_POLICY_PRIORITY_TYPE_NAME = 'MultifactorEnrollmentPolicyPriority'
export const AUTHORIZATION_POLICY_PRIORITY_TYPE_NAME = 'AuthorizationServerPolicyPriority'
export const PASSWORD_POLICY_PRIORITY_TYPE_NAME = 'PasswordPolicyPriority'
export const AUTOMATION_TYPE_NAME = 'Automation'
export const AUTOMATION_RULE_TYPE_NAME = 'AutomationRule'
export const JWK_TYPE_NAME = 'JsonWebKey'
export const EMBEDDED_SIGN_IN_SUPPORT_TYPE_NAME = 'EmbeddedSignInSuppport'
export const ACTIVE_STATUS = 'ACTIVE'
export const INACTIVE_STATUS = 'INACTIVE'
export const POLICY_TYPE_NAMES = [
  ACCESS_POLICY_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
  PASSWORD_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
]
export const POLICY_RULE_TYPE_NAMES = [
  ACCESS_POLICY_RULE_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  MFA_RULE_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
]
export const ID_FIELD = 'id'
export const NAME_FIELD = 'name'
export const CUSTOM_NAME_FIELD = 'customName'
export const LINKS_FIELD = '_links'
export const DEFINITIONS_FIELD = 'definitions'
export const BASE_FIELD = 'base'
export const SAML_2_0_APP = 'SAML_2_0'
export const GROUP_SCHEMA_TYPE_NAME = 'GroupSchema'
export const APP_USER_SCHEMA_TYPE_NAME = 'AppUserSchema'
export const APP_LOGO_TYPE_NAME = 'AppLogo'
export const BRAND_TYPE_NAME = 'Brand'
export const BRAND_THEME_TYPE_NAME = 'BrandTheme'
export const EMAIL_TEMPLATE_TYPE_NAME = 'EmailTemplate'
export const EMAIL_CUSTOMIZATION_TYPE_NAME = 'EmailCustomization'
export const BRAND_LOGO_TYPE_NAME = 'BrandLogo'
export const FAV_ICON_TYPE_NAME = 'FavIcon'
export const GROUP_MEMBERSHIP_TYPE_NAME = 'GroupMembership'
export const PROFILE_MAPPING_TYPE_NAME = 'ProfileMapping'
export const DEVICE_ASSURANCE_TYPE_NAME = 'DeviceAssurance'
export const EVENT_HOOK = 'EventHook'
export const GROUP_PUSH_TYPE_NAME = 'GroupPush'
export const GROUP_PUSH_RULE_TYPE_NAME = 'GroupPushRule'
export const DOMAIN_TYPE_NAME = 'Domain'
export const USER_TYPE_NAME = 'User'
export const USER_ROLES_TYPE_NAME = 'UserRoles'
export const SMS_TEMPLATE_TYPE_NAME = 'SmsTemplate'
export const SCHEMA_TYPES = [GROUP_SCHEMA_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, USER_SCHEMA_TYPE_NAME]
export const EMAIL_DOMAIN_TYPE_NAME = 'EmailDomain'
export const SIGN_IN_PAGE_TYPE_NAME = 'SignInPage'
export const ERROR_PAGE_TYPE_NAME = 'ErrorPage'
export const API_SCOPES_FIELD_NAME = 'apiScopes'

export const APP_PROVISIONING_FIELD_NAMES = [
  'applicationUserProvisioning',
  'applicationInboundProvisioning',
  'applicationProvisioningUsers',
  'applicationProvisioningGeneral',
]

// Apps with public APIs supporting inbound and user provisioning.
// Full list: https://developer.okta.com/docs/api/openapi/okta-management/management/tag/ApplicationFeatures
export const INBOUND_PROVISIONING_SUPPORTED_APP_NAMES = ['google', 'office365', 'okta_org2org', 'slack', 'zoomus']
export const USER_PROVISIONING_SUPPORTED_APP_NAMES = [...INBOUND_PROVISIONING_SUPPORTED_APP_NAMES, 'zscalerbyz']
