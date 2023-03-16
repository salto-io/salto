/*
*                      Copyright 2023 Salto Labs Ltd.
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
export const OKTA = 'okta'
export const APPLICATION_TYPE_NAME = 'Application'
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
export const ACCESS_POLICY_TYPE_NAME = 'AccessPolicy'
export const IDP_POLICY_TYPE_NAME = 'IdentityProviderPolicy'
export const MFA_POLICY_TYPE_NAME = 'MultifactorEnrollmentPolicy'
export const SIGN_ON_POLICY_TYPE_NAME = 'OktaSignOnPolicy'
export const PASSWORD_POLICY_TYPE_NAME = 'PasswordPolicy'
export const PROFILE_ENROLLMENT_POLICY_TYPE_NAME = 'ProfileEnrollmentPolicy'
export const ACCESS_POLICY_RULE_TYPE_NAME = 'AccessPolicyRule'
export const PROFILE_ENROLLMENT_RULE_TYPE_NAME = 'ProfileEnrollmentPolicyRule'
export const IDP_RULE_TYPE_NAME = 'IdentityProviderPolicyRule'
export const MFA_RULE_TYPE_NAME = 'MultifactorEnrollmentPolicyRule'
export const SIGN_ON_RULE_TYPE_NAME = 'OktaSignOnPolicyRule'
export const PASSWORD_RULE_TYPE_NAME = 'PasswordPolicyRule'
export const ACTIVE_STATUS = 'ACTIVE'
export const INACTIVE_STATUS = 'INACTIVE'
export const POLICY_TYPE_NAMES = [ACCESS_POLICY_TYPE_NAME, IDP_POLICY_TYPE_NAME, MFA_POLICY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME, PASSWORD_POLICY_TYPE_NAME, PROFILE_ENROLLMENT_POLICY_TYPE_NAME]
export const POLICY_RULE_TYPE_NAMES = [ACCESS_POLICY_RULE_TYPE_NAME, IDP_RULE_TYPE_NAME, MFA_RULE_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME, PASSWORD_RULE_TYPE_NAME, PROFILE_ENROLLMENT_RULE_TYPE_NAME]
