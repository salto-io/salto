/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ActionName } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import {
  ACCESS_POLICY_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  PASSWORD_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
} from './constants'
import { AdditionalAction } from './definitions/types'
import { POLICY_PRIORITY_TYPE_NAMES, POLICY_RULE_PRIORITY_TYPE_NAMES } from './filters/policy_priority'

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'
export const PRIVATE_API_DEFINITIONS_CONFIG = 'privateApiDefinitions'

export type OktaSwaggerApiConfig = configUtils.AdapterSwaggerApiConfig<ActionName | AdditionalAction>
type OktaDuckTypeApiConfig = configUtils.AdapterDuckTypeApiConfig

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
  OrgSetting: {
    deployRequests: {
      modify: {
        url: '/api/v1/org',
        method: 'put',
        fieldsToIgnore: ['contactTypes'],
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
}

const SUPPORTED_TYPES = {
  Application: ['api__v1__apps'],
  Authenticator: ['api__v1__authenticators'],
  AuthorizationServer: ['api__v1__authorizationServers'],
  AuthorizationServerPolicy: ['api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu'],
  Brand: ['api__v1__brands'],
  BrandTheme: ['api__v1__brands___brandId___themes@uuuuuu_00123_00125uu'],
  EventHook: ['api__v1__eventHooks'],
  Feature: ['api__v1__features'],
  Group: ['api__v1__groups'],
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

const DUCKTYPE_SUPPORTED_TYPES = {
  EmailNotifications: ['EmailNotifications'],
  EndUserSupport: ['EndUserSupport'],
  ThirdPartyAdmin: ['ThirdPartyAdmin'],
  EmbeddedSignInSuppport: ['EmbeddedSignInSuppport'],
  SignOutPage: ['SignOutPage'],
  BrowserPlugin: ['BrowserPlugin'],
  DisplayLanguage: ['DisplayLanguage'],
  Reauthentication: ['Reauthentication'],
}

const DUCKTYPE_API_DEFINITIONS: OktaDuckTypeApiConfig = {
  typeDefaults: {
    transformation: TRANSFORMATION_DEFAULTS,
  },
  types: DUCKTYPE_TYPES,
  supportedTypes: DUCKTYPE_SUPPORTED_TYPES,
}

const DEFAULT_API_DEFINITIONS: OktaSwaggerApiConfig = {
  swagger: { url: '' }, // TODO remove in SALTO-5692
  typeDefaults: { transformation: TRANSFORMATION_DEFAULTS },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const OLD_API_DEFINITIONS_CONFIG: OldOktaDefinitionsConfig = {
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
  [PRIVATE_API_DEFINITIONS_CONFIG]: DUCKTYPE_API_DEFINITIONS,
}
