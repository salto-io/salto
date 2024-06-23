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
import { ActionName } from '@salto-io/adapter-api'
import { config as configUtils, definitions } from '@salto-io/adapter-components'
import {
  ACCESS_POLICY_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  PASSWORD_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  POLICY_RULE_PRIORITY_TYPE_NAMES,
  POLICY_PRIORITY_TYPE_NAMES,
} from './constants'

type UserDeployConfig = definitions.UserDeployConfig

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'
export const PRIVATE_API_DEFINITIONS_CONFIG = 'privateApiDefinitions'

export type OktaStatusActionName = 'activate' | 'deactivate'
export type OktaActionName = ActionName | OktaStatusActionName

export type OktaSwaggerApiConfig = configUtils.AdapterSwaggerApiConfig<OktaActionName>
export type OktaDuckTypeApiConfig = configUtils.AdapterDuckTypeApiConfig
export type OktaDeployConfig = UserDeployConfig & { omitMissingUsers?: boolean }

// TODO remove as part of SALTO-5692
export type OldOktaDefinitionsConfig = {
  [API_DEFINITIONS_CONFIG]: OktaSwaggerApiConfig
  [PRIVATE_API_DEFINITIONS_CONFIG]: OktaDuckTypeApiConfig
}

const TRANSFORMATION_DEFAULTS: configUtils.TransformationDefaultConfig = { idFields: [] }

// Policy type is split to different kinds of policies
// The full list of policy types is taken from here:
// https://developer.okta.com/docs/reference/api/policy/#policy-types
type PolicyTypeNames =
  | 'AccessPolicy'
  | 'IdentityProviderPolicy'
  | 'MultifactorEnrollmentPolicy'
  | 'OktaSignOnPolicy'
  | 'PasswordPolicy'
  | 'ProfileEnrollmentPolicy'
  | 'Automation'

type PolicyParams = {
  queryParam: string
  ruleName: string
  policyServiceUrl: string
  ruleServiceUrl?: string
}

export const POLICY_TYPE_NAME_TO_PARAMS: Record<PolicyTypeNames, PolicyParams> = {
  [ACCESS_POLICY_TYPE_NAME]: {
    queryParam: 'ACCESS_POLICY',
    ruleName: 'AccessPolicyRule',
    policyServiceUrl: '/admin/authn/authentication-policies#authentication-policies/policy/{id}/',
  },
  [IDP_POLICY_TYPE_NAME]: {
    queryParam: 'IDP_DISCOVERY',
    ruleName: 'IdentityProviderPolicyRule',
    policyServiceUrl: '/admin/access/identity-providers#',
    ruleServiceUrl: '/admin/access/identity-providers#rules',
  },
  [MFA_POLICY_TYPE_NAME]: {
    queryParam: 'MFA_ENROLL',
    ruleName: 'MultifactorEnrollmentPolicyRule',
    policyServiceUrl: '/admin/access/multifactor#policies',
  },
  [SIGN_ON_POLICY_TYPE_NAME]: {
    queryParam: 'OKTA_SIGN_ON',
    ruleName: 'OktaSignOnPolicyRule',
    policyServiceUrl: '/admin/access/policies',
  },
  [PASSWORD_POLICY_TYPE_NAME]: {
    queryParam: 'PASSWORD',
    ruleName: 'PasswordPolicyRule',
    policyServiceUrl: '/admin/access/authenticators/password',
  },
  [PROFILE_ENROLLMENT_POLICY_TYPE_NAME]: {
    queryParam: 'PROFILE_ENROLLMENT',
    ruleName: 'ProfileEnrollmentPolicyRule',
    policyServiceUrl: '/admin/authn/policies',
  },
  [AUTOMATION_TYPE_NAME]: {
    queryParam: 'USER_LIFECYCLE',
    ruleName: 'AutomationRule',
    policyServiceUrl: '/admin/lifecycle-automation#tab-policy/{id}',
  },
}

const getPolicyItemsName = (policyName: string): string =>
  policyName === AUTOMATION_TYPE_NAME ? 'Automations' : `${policyName.slice(0, -1)}ies`
const getPolicyConfig = (): OktaSwaggerApiConfig['types'] => {
  const policiesConfig = Object.entries(POLICY_TYPE_NAME_TO_PARAMS).map(([typeName, details]) => {
    const policyRuleConfig = {
      deployRequests: {
        add: {
          url: '/api/v1/policies/{policyId}/rules',
          method: 'post',
          urlParamsToFields: {
            policyId: '_parent.0.id',
          },
        },
        modify: {
          url: '/api/v1/policies/{policyId}/rules/{ruleId}',
          method: 'put',
          urlParamsToFields: {
            policyId: '_parent.0.id',
            ruleId: 'id',
          },
        },
        remove: {
          url: '/api/v1/policies/{policyId}/rules/{ruleId}',
          method: 'delete',
          urlParamsToFields: {
            policyId: '_parent.0.id',
            ruleId: 'id',
          },
          omitRequestBody: true,
        },
        activate: {
          url: '/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate',
          method: 'post',
          urlParamsToFields: {
            policyId: '_parent.0.id',
            ruleId: 'id',
          },
        },
        deactivate: {
          url: '/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate',
          method: 'post',
          urlParamsToFields: {
            policyId: '_parent.0.id',
            ruleId: 'id',
          },
        },
      },
    }
    const policyDeployRequests = {
      add: {
        url: `/api/v1/policies${typeName === AUTOMATION_TYPE_NAME ? '?activate=false' : ''}`,
        method: 'post',
      },
      modify: {
        url: '/api/v1/policies/{policyId}',
        method: 'put',
        urlParamsToFields: {
          policyId: 'id',
        },
      },
      remove: {
        url: '/api/v1/policies/{policyId}',
        method: 'delete',
        urlParamsToFields: {
          policyId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/policies/{policyId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          policyId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/policies/{policyId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          policyId: 'id',
        },
      },
    }
    return {
      [typeName]: {
        deployRequests: typeName !== IDP_POLICY_TYPE_NAME ? policyDeployRequests : undefined,
      },
      [details.ruleName]: policyRuleConfig,
    }
  })
  return Object.assign({}, ...policiesConfig)
}
const getPolicyAndPolicyRulePriorityConfig = (): OktaSwaggerApiConfig['types'] => {
  const policyPrioritiesConfig = POLICY_RULE_PRIORITY_TYPE_NAMES.concat(POLICY_PRIORITY_TYPE_NAMES).map(typeName => ({
    // Hack to pass through createCheckDeploymentBasedOnConfigValidator validator only for additions and modifications
    [typeName]: {
      deployRequests: {
        add: { url: '', method: 'put' },
        modify: { url: '', method: 'put' },
        remove: { url: '', method: 'delete' },
      },
    },
  }))
  return Object.assign({}, ...policyPrioritiesConfig)
}

const DEFAULT_TYPE_CUSTOMIZATIONS: OktaSwaggerApiConfig['types'] = {
  Group: {
    deployRequests: {
      add: {
        url: '/api/v1/groups',
        method: 'post',
      },
      modify: {
        url: '/api/v1/groups/{groupId}',
        method: 'put',
        urlParamsToFields: {
          groupId: 'id',
        },
      },
      remove: {
        url: '/api/v1/groups/{groupId}',
        method: 'delete',
        urlParamsToFields: {
          groupId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  Application: {
    deployRequests: {
      add: {
        url: '/api/v1/apps',
        method: 'post',
      },
      modify: {
        url: '/api/v1/apps/{applicationId}',
        method: 'put',
        urlParamsToFields: {
          applicationId: 'id',
        },
      },
      remove: {
        url: '/api/v1/apps/{applicationId}',
        method: 'delete',
        urlParamsToFields: {
          applicationId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/apps/{applicationId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          applicationId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/apps/{applicationId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          applicationId: 'id',
        },
      },
    },
  },
  ApplicationGroupAssignment: {
    deployRequests: {
      add: {
        url: '/api/v1/apps/{appId}/groups/{groupId}',
        method: 'put',
        urlParamsToFields: {
          appId: '_parent.0.id',
          groupId: 'id',
        },
      },
      modify: {
        url: '/api/v1/apps/{appId}/groups/{groupId}',
        method: 'put',
        urlParamsToFields: {
          appId: '_parent.0.id',
          groupId: 'id',
        },
      },
      remove: {
        url: '/api/v1/apps/{appId}/groups/{groupId}',
        method: 'delete',
        urlParamsToFields: {
          appId: '_parent.0.id',
          groupId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  AppUserSchema: {
    deployRequests: {
      // Hack to pass through createCheckDeploymentBasedOnConfigValidator validator only for additions and removals
      add: {
        url: '',
        method: 'post',
      },
      modify: {
        url: '/api/v1/meta/schemas/apps/{applicationId}/default',
        method: 'post',
        urlParamsToFields: {
          applicationId: '_parent.0.id',
        },
      },
      remove: {
        url: '',
        method: 'delete',
      },
    },
  },
  AppLogo: {
    deployRequests: {
      add: {
        url: '/api/v1/apps/{appId}/logo',
        method: 'post',
        urlParamsToFields: {
          appId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v1/apps/{appId}/logo',
        method: 'post',
        urlParamsToFields: {
          appId: '_parent.0.id',
        },
      },
    },
  },
  UserSchema: {
    deployRequests: {
      add: {
        url: '/api/v1/meta/schemas/user/{schemaId}',
        method: 'post',
        urlParamsToFields: {
          schemaId: 'id',
        },
        fieldsToIgnore: ['id', 'name'],
      },
      modify: {
        url: '/api/v1/meta/schemas/user/{schemaId}',
        method: 'post',
        urlParamsToFields: {
          schemaId: 'id',
        },
        fieldsToIgnore: ['id', 'name'],
      },
      remove: {
        // we verify UserSchema is deleted by trying to delete the parent UserType
        url: '/api/v1/meta/types/user/{typeId}',
        method: 'delete',
        urlParamsToFields: {
          typeId: '_parent.0.id',
        },
        omitRequestBody: true,
      },
    },
  },
  AuthorizationServerPolicy: {
    deployRequests: {
      add: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies',
        method: 'post',
        urlParamsToFields: {
          authorizationServerId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}',
        method: 'put',
        urlParamsToFields: {
          authorizationServerId: '_parent.0.id',
          policyId: 'id',
        },
      },
      remove: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}',
        method: 'delete',
        urlParamsToFields: {
          authorizationServerId: '_parent.0.id',
          policyId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          authorizationServerId: '_parent.0.id',
          policyId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          authorizationServerId: '_parent.0.id',
          policyId: 'id',
        },
      },
    },
  },
  AuthorizationServerPolicyRule: {
    deployRequests: {
      add: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules',
        method: 'post',
        urlParamsToFields: {
          authorizationServerId: '_parent.1.id',
          policyId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}',
        method: 'put',
        urlParamsToFields: {
          authorizationServerId: '_parent.1.id',
          policyId: '_parent.0.id',
          ruleId: 'id',
        },
      },
      remove: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}',
        method: 'delete',
        urlParamsToFields: {
          authorizationServerId: '_parent.1.id',
          policyId: '_parent.0.id',
          ruleId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          authorizationServerId: '_parent.1.id',
          policyId: '_parent.0.id',
          ruleId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          authorizationServerId: '_parent.1.id',
          policyId: '_parent.0.id',
          ruleId: 'id',
        },
      },
    },
  },
  GroupSchema: {
    deployRequests: {
      modify: {
        url: '/api/v1/meta/schemas/group/default',
        method: 'post',
      },
    },
  },
  Domain: {
    deployRequests: {
      add: {
        url: '/api/v1/domains',
        method: 'post',
      },
      modify: {
        url: '/api/v1/domains/{domainId}',
        method: 'put',
        urlParamsToFields: {
          domainId: 'id',
        },
      },
      remove: {
        url: '/api/v1/domains/{domainId}',
        method: 'delete',
        urlParamsToFields: {
          domainId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  OrgSetting: {
    deployRequests: {
      modify: {
        url: '/api/v1/org',
        method: 'put',
        fieldsToIgnore: ['contactTypes'],
      },
    },
  },
  Brand: {
    deployRequests: {
      add: {
        url: '/api/v1/brands',
        method: 'post',
      },
      modify: {
        url: '/api/v1/brands/{brandId}',
        method: 'put',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
      remove: {
        url: '/api/v1/brands/{brandId}',
        method: 'delete',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
    },
  },
  BrandTheme: {
    deployRequests: {
      add: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}',
        method: 'put',
        urlParamsToFields: {
          brandId: '_parent.0.id',
          themeId: 'id',
        },
        fieldsToIgnore: ['id'],
      },
      modify: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}',
        method: 'put',
        urlParamsToFields: {
          brandId: '_parent.0.id',
          themeId: 'id',
        },
        fieldsToIgnore: ['id', 'logo', 'favicon', '_links'],
      },
      remove: {
        // BrandThemes are removed automatically by Okta when the Brand is removed.
        // We use an empty URL here to mark this action as supported in case a user removed the theme
        // alongside its Brand.
        // A separate Change Validator ensures that mappings aren't removed by themselves.
        url: '',
        method: 'delete', // This is just for typing, we intercept it in a filter and use `get`.
      },
    },
  },
  BrandLogo: {
    deployRequests: {
      add: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}/logo',
        method: 'post',
        urlParamsToFields: {
          themeId: '_parent.0.id',
          brandId: '_parent.1.id',
        },
      },
      modify: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}/logo',
        method: 'post',
        urlParamsToFields: {
          themeId: '_parent.0.id',
          brandId: '_parent.1.id',
        },
      },
      remove: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}/logo',
        method: 'delete',
        urlParamsToFields: {
          themeId: '_parent.0.id',
          brandId: '_parent.1.id',
        },
        omitRequestBody: true,
      },
    },
  },
  FavIcon: {
    deployRequests: {
      add: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}/favicon',
        method: 'post',
        urlParamsToFields: {
          themeId: '_parent.0.id',
          brandId: '_parent.1.id',
        },
      },
      modify: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}/favicon',
        method: 'post',
        urlParamsToFields: {
          themeId: '_parent.0.id',
          brandId: '_parent.1.id',
        },
      },
      remove: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}/favicon',
        method: 'delete',
        urlParamsToFields: {
          themeId: '_parent.0.id',
          brandId: '_parent.1.id',
        },
        omitRequestBody: true,
      },
    },
  },
  Authenticator: {
    deployRequests: {
      add: {
        url: '/api/v1/authenticators',
        method: 'post',
      },
      modify: {
        url: '/api/v1/authenticators/{authenticatorId}',
        method: 'put',
        urlParamsToFields: {
          authenticatorId: 'id',
        },
      },
      activate: {
        url: '/api/v1/authenticators/{authenticatorId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          authenticatorId: 'id',
        },
      },
      // There is no endpoint for remove, deactivating authenticator removes it
      deactivate: {
        url: '/api/v1/authenticators/{authenticatorId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          authenticatorId: 'id',
        },
      },
    },
  },
  GroupRule: {
    deployRequests: {
      add: {
        url: '/api/v1/groups/rules',
        method: 'post',
        // status update deployed through different endpoint
        fieldsToIgnore: ['status', 'allGroupsValid'],
      },
      modify: {
        url: '/api/v1/groups/rules/{ruleId}',
        method: 'put',
        urlParamsToFields: {
          ruleId: 'id',
        },
        // status update deployed through different endpoint
        fieldsToIgnore: ['status', 'allGroupsValid'],
      },
      remove: {
        url: '/api/v1/groups/rules/{ruleId}',
        method: 'delete',
        urlParamsToFields: {
          ruleId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/groups/rules/{ruleId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          ruleId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/groups/rules/{ruleId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          ruleId: 'id',
        },
      },
    },
  },
  NetworkZone: {
    deployRequests: {
      add: {
        url: '/api/v1/zones',
        method: 'post',
      },
      modify: {
        url: '/api/v1/zones/{zoneId}',
        method: 'put',
        urlParamsToFields: {
          zoneId: 'id',
        },
      },
      remove: {
        url: '/api/v1/zones/{zoneId}',
        method: 'delete',
        urlParamsToFields: {
          zoneId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/zones/{zoneId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          zoneId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/zones/{zoneId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          zoneId: 'id',
        },
      },
    },
  },
  TrustedOrigin: {
    deployRequests: {
      add: {
        url: '/api/v1/trustedOrigins',
        method: 'post',
      },
      modify: {
        url: '/api/v1/trustedOrigins/{trustedOriginId}',
        method: 'put',
        urlParamsToFields: {
          trustedOriginId: 'id',
        },
      },
      remove: {
        url: '/api/v1/trustedOrigins/{trustedOriginId}',
        method: 'delete',
        urlParamsToFields: {
          trustedOriginId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/trustedOrigins/{trustedOriginId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          trustedOriginId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/trustedOrigins/{trustedOriginId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          trustedOriginId: 'id',
        },
      },
    },
  },
  UserType: {
    deployRequests: {
      add: {
        url: '/api/v1/meta/types/user',
        method: 'post',
      },
      modify: {
        url: '/api/v1/meta/types/user/{typeId}',
        method: 'put',
        urlParamsToFields: {
          typeId: 'id',
        },
      },
      remove: {
        url: '/api/v1/meta/types/user/{typeId}',
        method: 'delete',
        urlParamsToFields: {
          typeId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  SmsTemplate: {
    deployRequests: {
      add: {
        url: '/api/v1/templates/sms',
        method: 'post',
      },
      modify: {
        url: '/api/v1/templates/sms/{templateId}',
        method: 'put',
        urlParamsToFields: {
          templateId: 'id',
        },
      },
      remove: {
        url: '/api/v1/templates/sms/{templateId}',
        urlParamsToFields: {
          templateId: 'id',
        },
        method: 'delete',
      },
    },
  },
  ProfileMapping: {
    deployRequests: {
      add: {
        url: '/api/v1/mappings/{mappingId}',
        method: 'post',
        urlParamsToFields: {
          mappingId: 'id',
        },
      },
      modify: {
        url: '/api/v1/mappings/{mappingId}',
        method: 'post',
        urlParamsToFields: {
          mappingId: 'id',
        },
      },
      remove: {
        // ProfileMappings are removed automatically by Okta when either side of the mapping is removed.
        // We use an empty URL here to mark this action as supported in case a user removed the mapping
        // alongside either side.
        // A separate Change Validator ensures that mappings aren't removed by themselves.
        url: '',
        method: 'delete', // This is just for typing, we intercept it in a filter and use `get`.
      },
    },
  },
  ...getPolicyConfig(),
  ...getPolicyAndPolicyRulePriorityConfig(),
  BehaviorRule: {
    deployRequests: {
      add: {
        url: '/api/v1/behaviors',
        method: 'post',
      },
      modify: {
        url: '/api/v1/behaviors/{behaviorId}',
        method: 'put',
        urlParamsToFields: {
          behaviorId: 'id',
        },
      },
      remove: {
        url: '/api/v1/behaviors/{behaviorId}',
        method: 'delete',
        urlParamsToFields: {
          behaviorId: 'id',
        },
        omitRequestBody: true,
      },
      activate: {
        url: '/api/v1/behaviors/{behaviorId}/lifecycle/activate',
        method: 'post',
        urlParamsToFields: {
          behaviorId: 'id',
        },
      },
      deactivate: {
        url: '/api/v1/behaviors/{behaviorId}/lifecycle/deactivate',
        method: 'post',
        urlParamsToFields: {
          behaviorId: 'id',
        },
      },
    },
  },
  PerClientRateLimitSettings: {
    deployRequests: {
      modify: {
        url: '/api/v1/rate-limit-settings/per-client',
        method: 'put',
      },
    },
  },
  RateLimitAdminNotifications: {
    deployRequests: {
      modify: {
        url: '/api/v1/rate-limit-settings/admin-notifications',
        method: 'put',
      },
    },
  },
  DeviceAssurance: {
    deployRequests: {
      add: {
        url: '/api/v1/device-assurances',
        method: 'post',
      },
      modify: {
        url: '/api/v1/device-assurances/{deviceAssuranceId}',
        method: 'put',
        urlParamsToFields: {
          deviceAssuranceId: 'id',
        },
      },
      remove: {
        url: '/api/v1/device-assurances/{deviceAssuranceId}',
        method: 'delete',
        urlParamsToFields: {
          deviceAssuranceId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
}

export const SUPPORTED_TYPES = {
  Application: ['api__v1__apps'],
  Authenticator: ['api__v1__authenticators'],
  AuthorizationServer: ['api__v1__authorizationServers'],
  AuthorizationServerPolicy: ['api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu'],
  Brand: ['api__v1__brands'],
  BrandTheme: ['api__v1__brands___brandId___themes@uuuuuu_00123_00125uu'],
  EventHook: ['api__v1__eventHooks'],
  Feature: ['api__v1__features'],
  Group: ['api__v1__groups'],
  GroupRule: ['api__v1__groups__rules'],
  IdentityProvider: ['api__v1__idps'],
  InlineHook: ['api__v1__inlineHooks'],
  ProfileMapping: ['api__v1__mappings'],
  LinkedObjectDefinitions: ['api__v1__meta__schemas__user__linkedObjects'],
  GroupSchema: ['GroupSchema'],
  UserSchema: ['UserSchema'],
  UserType: ['api__v1__meta__types__user'],
  OrgSettings: ['OrgSetting'],
  ...Object.fromEntries(
    Object.keys(POLICY_TYPE_NAME_TO_PARAMS).map(typeName => [typeName, [getPolicyItemsName(typeName)]]),
  ),
  SmsTemplate: ['api__v1__templates__sms'],
  TrustedOrigin: ['api__v1__trustedOrigins'],
  NetworkZone: ['api__v1__zones'],
  Domain: ['DomainListResponse'],
  EmailDomain: ['api__v1__email_domains@uuuub'],
  Role: ['IamRoles'],
  BehaviorRule: ['api__v1__behaviors'],
  PerClientRateLimit: ['PerClientRateLimitSettings'],
  RateLimitAdmin: ['RateLimitAdminNotifications'],
  ResourceSet: ['ResourceSets'],
  DeviceAssurance: ['api__v1__device_assurances@uuuub'],
}

const DUCKTYPE_TYPES: OktaDuckTypeApiConfig['types'] = {
  EmailNotifications: {
    deployRequests: {
      modify: {
        url: '/api/internal/email-notifications',
        method: 'put',
      },
    },
  },
  EndUserSupport: {
    deployRequests: {
      modify: {
        url: '/api/internal/enduser-support',
        method: 'post',
      },
    },
  },
  ThirdPartyAdmin: {
    deployRequests: {
      modify: {
        url: '/api/internal/orgSettings/thirdPartyAdminSetting',
        method: 'post',
      },
    },
  },
  EmbeddedSignInSuppport: {
    deployRequests: {
      modify: {
        url: '/admin/api/v1/embedded-login-settings',
        method: 'post',
      },
    },
  },
  SignOutPage: {
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/signout-page',
        method: 'post',
      },
    },
  },
  BrowserPlugin: {
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/browserplugin',
        method: 'post',
      },
    },
  },
  DisplayLanguage: {
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/locale',
        method: 'post',
      },
    },
  },
  Reauthentication: {
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/reauth-expiration',
        method: 'post',
      },
    },
  },
  GroupPush: {
    deployRequests: {
      add: {
        url: '/api/internal/instance/{appId}/grouppush',
        method: 'post',
        urlParamsToFields: {
          appId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/internal/instance/{appId}/grouppush/{pushId}/delete',
        method: 'post',
        urlParamsToFields: {
          appId: '_parent.0.id',
          pushId: 'mappingId',
        },
        fieldsToIgnore: ['mappingId', 'status', 'userGroupId', 'newAppGroupName', 'groupPushRule'],
      },
    },
  },
  GroupPushRule: {
    deployRequests: {
      add: {
        url: '/api/internal/instance/{appId}/grouppushrules',
        method: 'post',
        urlParamsToFields: {
          appId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/internal/instance/{appId}/grouppushrules/{ruleId}',
        method: 'put',
        urlParamsToFields: {
          appId: '_parent.0.id',
          ruleId: 'mappingRuleId',
        },
        fieldsToIgnore: ['mappingRuleId'],
      },
      remove: {
        url: '/api/internal/instance/{appId}/grouppushrules/{ruleId}',
        method: 'delete',
        urlParamsToFields: {
          appId: '_parent.0.id',
          ruleId: 'mappingRuleId',
        },
        fieldsToIgnore: [
          'mappingRuleId',
          'name',
          'status',
          'searchExpression',
          'descriptionSearchExpression',
          'searchExpressionType',
          'descriptionSearchExpressionType',
        ],
      },
    },
  },
  GroupMembership: {
    // Hack to pass through createCheckDeploymentBasedOnConfigValidator validator only for additions and modifications
    deployRequests: {
      add: { url: '', method: 'put' },
      modify: { url: '', method: 'put' },
    },
  },
}

export const DUCKTYPE_SUPPORTED_TYPES = {
  EmailNotifications: ['EmailNotifications'],
  EndUserSupport: ['EndUserSupport'],
  ThirdPartyAdmin: ['ThirdPartyAdmin'],
  EmbeddedSignInSuppport: ['EmbeddedSignInSuppport'],
  SignOutPage: ['SignOutPage'],
  BrowserPlugin: ['BrowserPlugin'],
  DisplayLanguage: ['DisplayLanguage'],
  Reauthentication: ['Reauthentication'],
}

export const DUCKTYPE_API_DEFINITIONS: OktaDuckTypeApiConfig = {
  typeDefaults: {
    transformation: TRANSFORMATION_DEFAULTS,
  },
  types: DUCKTYPE_TYPES,
  supportedTypes: DUCKTYPE_SUPPORTED_TYPES,
}

export const DEFAULT_API_DEFINITIONS: OktaSwaggerApiConfig = {
  swagger: { url: '' }, // TODO remove in SALTO-5692
  typeDefaults: { transformation: TRANSFORMATION_DEFAULTS },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const OLD_API_DEFINITIONS_CONFIG: OldOktaDefinitionsConfig = {
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
  [PRIVATE_API_DEFINITIONS_CONFIG]: DUCKTYPE_API_DEFINITIONS,
}

export type FilterContext = OldOktaDefinitionsConfig
