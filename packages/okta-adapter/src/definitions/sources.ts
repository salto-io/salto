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
import { definitions } from '@salto-io/adapter-components'
import { ClientOptions } from './types'

export const OPEN_API_DEFINITIONS: definitions.sources.OpenAPIDefinition<ClientOptions> = {
  url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/okta/management-swagger-v3.yaml',
  toClient: 'main',
  typeAdjustments: {
    Role: { originalTypeName: 'IamRole', rename: true },
    Domain: { originalTypeName: 'DomainResponse', rename: true },
    BrandTheme: { originalTypeName: 'ThemeResponse', rename: true },
    EmailDomain: { originalTypeName: 'EmailDomainResponse', rename: true },
    AppUserSchema: { originalTypeName: 'UserSchema', rename: false },
    ContactType: { originalTypeName: 'OrgContactTypeObj', rename: true },
    // IdentityProviderPolicy and MultifactorEnrollmentPolicy don't have their own 'rule' type.
    IdentityProviderPolicyRule: { originalTypeName: 'PolicyRule', rename: false },
    MultifactorEnrollmentPolicyRule: { originalTypeName: 'PolicyRule', rename: false },
    Group__source: { originalTypeName: 'AppAndInstanceConditionEvaluatorAppOrInstance', rename: false },
    DeviceCondition: { originalTypeName: 'PolicyNetworkCondition', rename: false },
    // Automation type is not documented in swagger
    Automation: { originalTypeName: 'AccessPolicy', rename: false },
    AutomationRule: { originalTypeName: 'PolicyRule', rename: false },
    UserTypeRef: { originalTypeName: 'UserType', rename: false },
  },
}
