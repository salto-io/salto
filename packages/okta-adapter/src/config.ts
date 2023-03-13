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
import _ from 'lodash'
import { ElemID, CORE_ANNOTATIONS, ActionName } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, elements } from '@salto-io/adapter-components'
import { ACCESS_POLICY_TYPE_NAME, IDP_POLICY_TYPE_NAME, MFA_POLICY_TYPE_NAME, OKTA, PASSWORD_POLICY_TYPE_NAME, PROFILE_ENROLLMENT_POLICY_TYPE_NAME, SIGN_ON_POLICY_TYPE_NAME } from './constants'

const { createClientConfigType } = clientUtils
const { createUserFetchConfigType, createSwaggerAdapterApiConfigType } = configUtils

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type OktaClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>
export type OktaActionName = ActionName | 'activate' | 'deactivate'
export type OktaFetchConfig = configUtils.UserFetchConfig
export type OktaApiConfig = configUtils.AdapterSwaggerApiConfig<OktaActionName>

export type OktaConfig = {
  [CLIENT_CONFIG]?: OktaClientConfig
  [FETCH_CONFIG]: OktaFetchConfig
  [API_DEFINITIONS_CONFIG]: OktaApiConfig
}

const DEFAULT_ID_FIELDS = ['name']
const DEFAULT_FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created' },
  { fieldName: 'lastUpdated' },
  { fieldName: 'createdBy' },
  { fieldName: 'lastUpdatedBy' },
]

// Policy type is split to different kinds of policies
// The full list of policy types is taken from here:
// https://developer.okta.com/docs/reference/api/policy/#policy-types
type PolicyTypeNames = 'AccessPolicy' | 'IdentityProviderPolicy' | 'MultifactorEnrollmentPolicy' | 'OktaSignOnPolicy' | 'PasswordPolicy' | 'ProfileEnrollmentPolicy'

type PolicyParams = {
  queryParam: string
  ruleName: string
}

const POLICY_TYPE_NAME_TO_PARAMS: Record<PolicyTypeNames, PolicyParams> = {
  [ACCESS_POLICY_TYPE_NAME]: {
    queryParam: 'ACCESS_POLICY',
    ruleName: 'AccessPolicyRule',
  },
  [IDP_POLICY_TYPE_NAME]: {
    queryParam: 'IDP_DISCOVERY',
    ruleName: 'IdentityProviderPolicyRule',
  },
  [MFA_POLICY_TYPE_NAME]: {
    queryParam: 'MFA_ENROLL',
    ruleName: 'MultifactorEnrollmentPolicyRule',
  },
  [SIGN_ON_POLICY_TYPE_NAME]: {
    queryParam: 'OKTA_SIGN_ON',
    ruleName: 'OktaSignOnPolicyRule',
  },
  [PASSWORD_POLICY_TYPE_NAME]: {
    queryParam: 'PASSWORD',
    ruleName: 'PasswordPolicyRule',
  },
  [PROFILE_ENROLLMENT_POLICY_TYPE_NAME]: {
    queryParam: 'PROFILE_ENROLLMENT',
    ruleName: 'ProfileEnrollmentPolicyRule',
  },
}

const getPolicyItemsName = (policyName: string): string => (`${(policyName).slice(0, -1)}ies`)
const getPolicyRuleItemsName = (policyRuleName: string):string => (`${policyRuleName}s`)
const getPolicyConfig = (): OktaApiConfig['types'] => {
  const policiesConfig = Object.entries(POLICY_TYPE_NAME_TO_PARAMS).map(([typeName, details]) => {
    const policyRuleConfig = {
      transformation: {
        serviceIdField: 'id',
        fieldsToHide: [{ fieldName: 'id' }],
        fieldTypeOverrides: [{ fieldName: '_links', fieldType: 'LinksSelf' }],
        fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      },
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
        url: '/api/v1/policies',
        method: 'post',
        fieldsToIgnore: ['policyRules'],
      },
      modify: {
        url: '/api/v1/policies/{policyId}',
        method: 'put',
        urlParamsToFields: {
          policyId: 'id',
        },
        fieldsToIgnore: ['policyRules'],
      },
      remove: {
        url: '/api/v1/policies/{policyId}',
        method: 'delete',
        urlParamsToFields: {
          policyId: 'id',
        },
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
    if ([IDP_POLICY_TYPE_NAME, MFA_POLICY_TYPE_NAME].includes(typeName)) {
      _.set(
        policyRuleConfig.transformation,
        'fieldTypeOverrides',
        [
          { fieldName: '_links', fieldType: 'LinksSelf' },
          { fieldName: 'actions', fieldType: 'PolicyRuleActions' },
          { fieldName: 'conditions', fieldType: 'PolicyRuleConditions' },
        ]
      )
    }
    return {
      [getPolicyItemsName(typeName)]: {
        request: {
          url: '/api/v1/policies',
          queryParams: {
            type: details.queryParam,
          },
          recurseInto: [
            {
              type: getPolicyRuleItemsName(details.ruleName),
              toField: 'policyRules',
              context: [{ name: 'policyId', fromField: 'id' }],
            },
          ],
        },
        transformation: {
          fieldTypeOverrides: [{ fieldName: 'items', fieldType: `list<${typeName}>` }],
        },
      },
      [getPolicyRuleItemsName(details.ruleName)]: {
        request: {
          url: '/api/v1/policies/{policyId}/rules',
        },
        transformation: {
          dataField: '.',
          fieldTypeOverrides: [{ fieldName: 'items', fieldType: `list<${details.ruleName}>` }],
        },
      },
      [typeName]: {
        transformation: {
          serviceIdField: 'id',
          fieldsToHide: [{ fieldName: 'id' }],
          fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
          fieldTypeOverrides: [{ fieldName: 'policyRules', fieldType: `list<${details.ruleName}>` }],
          standaloneFields: [{ fieldName: 'policyRules' }],
        },
        deployRequests: typeName !== IDP_POLICY_TYPE_NAME ? policyDeployRequests : undefined,
      },
      [details.ruleName]: policyRuleConfig,
    }
  })
  return Object.assign({}, ...policiesConfig)
}

const DEFAULT_TYPE_CUSTOMIZATIONS: OktaApiConfig['types'] = {
  api__v1__groups: {
    request: {
      url: '/api/v1/groups',
      recurseInto: [
        {
          type: 'api__v1__groups___groupId___roles@uuuuuu_00123_00125uu',
          toField: 'roles',
          context: [{ name: 'groupId', fromField: 'id' }],
        },
      ],
    },
  },
  Group: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'apps', fieldType: 'list<Application>' },
        { fieldName: 'roles', fieldType: 'list<Role>' },
      ],
      fieldsToHide: [
        { fieldName: 'id' },
      ],
      fieldsToOmit: [
        { fieldName: 'created' },
        { fieldName: 'lastUpdated' },
        { fieldName: 'lastMembershipUpdated' },
        { fieldName: '_links' },
      ],
      idFields: ['profile.name'],
      serviceIdField: 'id',
    },
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
      },
    },
  },
  'api__v1__groups___groupId___roles@uuuuuu_00123_00125uu': {
    request: {
      url: '/api/v1/groups/{groupId}/roles',
      recurseInto: [
        {
          type: 'api__v1__groups___groupId___roles___roleId___targets__groups@uuuuuu_00123_00125uuuu_00123_00125uuuu',
          toField: 'targetGroups',
          context: [{ name: 'roleId', fromField: 'id' }],
        },
      ],
    },
  },
  Role: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'targetGroups', fieldType: 'list<Group>' },
      ],
      idFields: ['label'],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  api__v1__apps: {
    request: {
      url: '/api/v1/apps',
      recurseInto: [
        {
          type: 'api__v1__apps___appId___credentials__csrs@uuuuuu_00123_00125uuuu',
          toField: 'CSRs',
          context: [{ name: 'appId', fromField: 'id' }],
        },
        {
          type: 'api__v1__apps___appId___groups@uuuuuu_00123_00125uu',
          toField: 'assignedGroups',
          context: [{ name: 'appId', fromField: 'id' }],
        },
        {
          type: 'api__v1__apps___appId___features@uuuuuu_00123_00125uu',
          toField: 'appFeatures',
          context: [{ name: 'appId', fromField: 'id' }],
          skipOnError: true,
        },
      ],
    },
  },
  Application: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'name', fieldType: 'string' },
        { fieldName: 'credentials', fieldType: 'ApplicationCredentials' },
        { fieldName: 'settings', fieldType: 'unknown' },
        { fieldName: 'CSRs', fieldType: 'list<Csr>' },
        { fieldName: 'assignedGroups', fieldType: 'list<ApplicationGroupAssignment>' },
        { fieldName: 'profileEnrollment', fieldType: 'string' },
        { fieldName: 'accessPolicy', fieldType: 'string' },
      ],
      idFields: ['label'],
      serviceIdField: 'id',
      fieldsToHide: [
        { fieldName: 'id' },
        { fieldName: '_links' },
      ],
      fieldsToOmit: [
        { fieldName: 'created' },
        { fieldName: 'lastUpdated' },
      ],
    },
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
  ApplicationCredentials: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'oauthClient', fieldType: 'ApplicationCredentialsOAuthClient' },
        { fieldName: 'password', fieldType: 'PasswordCredential' },
        { fieldName: 'revealPassword', fieldType: 'boolean' },
        { fieldName: 'scheme', fieldType: 'string' },
        { fieldName: 'userName', fieldType: 'string' },
      ],
    },
  },
  api__v1__meta__types__user: {
    transformation: {
      // by default there is an unwanted traversal here
      dataField: '.',
    },
  },
  api__v1__idps: {
    request: {
      url: '/api/v1/idps',
      recurseInto: [
        {
          type: 'api__v1__idps___idpId___credentials__csrs@uuuuuu_00123_00125uuuu',
          toField: 'CSRs',
          context: [{ name: 'idpId', fromField: 'id' }],
        },
      ],
    },
  },
  IdentityProvider: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'CSRs', fieldType: 'list<Csr>' },
      ],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  api__v1__features: {
    request: {
      url: '/api/v1/features',
      recurseInto: [
        {
          // Additional features that need to be enabled in order to enable the feature
          type: 'api__v1__features___featureId___dependencies@uuuuuu_00123_00125uu',
          toField: 'featureDependencies',
          context: [{ name: 'featureId', fromField: 'id' }],
        },
      ],
    },
  },
  Feature: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'featureDependencies', fieldType: 'list<Feature>' },
      ],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  UserSchema: {
    request: {
      url: '/api/v1/meta/schemas/user/default',
    },
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'description', fieldType: 'string' }],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  OrgContactTypeObj: {
    transformation: {
      idFields: ['contactType'],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
    },
  },
  api__v1__templates__sms: {
    transformation: {
      dataField: '.',
    },
  },
  api__v1__authorizationServers: {
    request: {
      url: '/api/v1/authorizationServers',
      recurseInto: [
        {
          type: 'api__v1__authorizationServers___authServerId___scopes@uuuuuu_00123_00125uu',
          toField: 'scopes',
          context: [{ name: 'authServerId', fromField: 'id' }],
        },
        {
          type: 'api__v1__authorizationServers___authServerId___claims@uuuuuu_00123_00125uu',
          toField: 'claims',
          context: [{ name: 'authServerId', fromField: 'id' }],
        },
        {
          type: 'api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu',
          toField: 'policies',
          context: [{ name: 'authServerId', fromField: 'id' }],
        },
        {
          type: 'api__v1__authorizationServers___authServerId___clients@uuuuuu_00123_00125uu',
          toField: 'clients',
          context: [{ name: 'authServerId', fromField: 'id' }],
        },
      ],
    },
  },
  'api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu': {
    request: {
      url: '/api/v1/authorizationServers/{authServerId}/policies',
      recurseInto: [
        {
          type: 'api__v1__authorizationServers___authServerId___policies___policyId___rules@uuuuuu_00123_00125uuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  AuthorizationServer: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'scopes', fieldType: 'list<OAuth2Scope>' },
        { fieldName: 'claims', fieldType: 'list<OAuth2Claim>' },
        { fieldName: 'policies', fieldType: 'list<AuthorizationServerPolicy>' },
        { fieldName: 'clients', fieldType: 'list<OAuth2Client>' },
      ],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
      serviceIdField: 'id',
      standaloneFields: [{ fieldName: 'policies' }],
    },
  },
  AuthorizationServerPolicy: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'policyRules', fieldType: 'list<AuthorizationServerPolicyRule>' },
      ],
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      standaloneFields: [{ fieldName: 'policyRules' }],
    },
  },
  AuthorizationServerPolicyRule: {
    transformation: {
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      fieldTypeOverrides: [{ fieldName: '_links', fieldType: 'LinksSelf' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
    },
  },
  api__v1__brands: {
    request: {
      url: '/api/v1/brands',
      recurseInto: [
        {
          type: 'api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu',
          toField: 'emailTemplates',
          context: [{ name: 'brandId', fromField: 'id' }],
        },
        {
          type: 'api__v1__brands___brandId___themes@uuuuuu_00123_00125uu',
          toField: 'themes',
          context: [{ name: 'brandId', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: '.',
    },
  },
  'api__v1__brands___brandId___themes@uuuuuu_00123_00125uu': {
    transformation: {
      dataField: '.',
    },
  },
  'api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu': {
    transformation: {
      dataField: '.',
    },
  },
  GroupSchema: {
    transformation: {
      idFields: ['title'],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  Domain: {
    transformation: {
      isSingleton: true,
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  OrgSetting: {
    request: {
      url: '/api/v1/org',
      recurseInto: [{
        type: 'api__v1__org__contacts',
        toField: 'contactTypes',
        context: [],
      }],
    },
    transformation: {
      isSingleton: true,
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      dataField: '.',
      fieldTypeOverrides: [{ fieldName: 'contactTypes', fieldType: 'list<OrgContactTypeObj>' }],
    },
  },
  api__v1__org__contacts: {
    request: {
      url: '/api/v1/org/contacts',
    },
    transformation: {
      dataField: '.',
    },
  },
  Brand: {
    transformation: {
      isSingleton: true,
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  Authenticator: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  EventHook: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  GroupRule: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'allGroupsValid', fieldType: 'boolean' }],
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
    },
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
  InlineHook: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  NetworkZone: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
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
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  UserType: {
    transformation: {
      serviceIdField: 'id',
      fieldsToHide: [
        { fieldName: 'id' },
        { fieldName: '_links' },
      ],
    },
  },
  GroupSchemaAttribute: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'scope', fieldType: 'string' },
      ],
    },
  },
  UserSchemaAttribute: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'scope', fieldType: 'string' },
      ],
    },
  },
  RolePage: {
    request: {
      url: '/api/v1/iam/roles',
    },
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'roles', fieldType: 'Role' },
      ],
      dataField: 'roles',
    },
  },
  SmsTemplate: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'created' },
        { fieldName: 'lastUpdated' },
      ],
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  Protocol: {
    transformation: {
      fieldsToOmit: [
        // we are not managing secrets
        { fieldName: 'credentials' },
      ],
    },
  },
  AuthenticatorProviderConfiguration: {
    transformation: {
      fieldsToOmit: [
        // we are not managing secrets
        { fieldName: 'secretKey' },
        { fieldName: 'sharedSecret' },
      ],
    },
  },
  OAuth2Scope: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: '_links', fieldType: 'map<unknown>' },
      ],
      fieldsToOmit: [
        { fieldName: '_links' },
      ],
    },
  },
  OAuth2Claim: {
    transformation: {
      fieldsToOmit: [
        { fieldName: '_links' },
      ],
    },
  },
  ProfileMapping: {
    transformation: {
      idFields: ['source.name', 'target.name'],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  ProfileMappingSource: {
    transformation: {
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
    },
  },
  ApplicationLinks: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'profileEnrollment', fieldType: 'HrefObject' }],
    },
  },
  ...getPolicyConfig(),
  api__v1__behaviors: {
    request: {
      url: '/api/v1/behaviors',
    },
    transformation: {
      dataField: '.',
    },
  },
  BehaviorRule: {
    transformation: {
      fieldsToHide: [{ fieldName: 'id' }],
      fieldTypeOverrides: [{ fieldName: '_links', fieldType: 'LinksSelf' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
    },
  },
}

const DEFAULT_SWAGGER_CONFIG: OktaApiConfig['swagger'] = {
  url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/okta/management-swagger-v3.yaml',
  additionalTypes: [
    ...Object.keys(POLICY_TYPE_NAME_TO_PARAMS)
      .map(policyTypeName => ({ typeName: getPolicyItemsName(policyTypeName), cloneFrom: 'api__v1__policies' })),
    ...Object.values(POLICY_TYPE_NAME_TO_PARAMS)
      .map(policy => ({ typeName: getPolicyRuleItemsName(policy.ruleName), cloneFrom: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu' })),
    // IdentityProviderPolicy and MultifactorEnrollmentPolicy don't have their own 'rule' type
    { typeName: 'IdentityProviderPolicyRule', cloneFrom: 'PolicyRule' },
    { typeName: 'MultifactorEnrollmentPolicyRule', cloneFrom: 'PolicyRule' },
    // TODO SALTO-2735 this is not the right type to clone from
    { typeName: 'RolePage', cloneFrom: 'api__v1__groups___groupId___roles@uuuuuu_00123_00125uu' },
  ],
  typeNameOverrides: [
    { originalName: 'DomainResponse', newName: 'Domain' },
  ],
}

export const SUPPORTED_TYPES = {
  Application: [
    'api__v1__apps',
  ],
  Authenticator: ['api__v1__authenticators'],
  AuthorizationServer: ['api__v1__authorizationServers'],
  AuthorizationServerPolicy: ['api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu'],
  Brand: ['api__v1__brands'],
  EventHook: ['api__v1__eventHooks'],
  Feature: ['api__v1__features'],
  Group: [
    'api__v1__groups',
  ],
  GroupRule: ['api__v1__groups__rules'],
  IdentityProvider: [
    'api__v1__idps',
  ],
  InlineHook: ['api__v1__inlineHooks'],
  // TODO SALTO-2734 returns 401
  ProfileMapping: ['api__v1__mappings'],
  LinkedObjectDefinitions: ['api__v1__meta__schemas__user__linkedObjects'],
  GroupSchema: ['GroupSchema'],
  UserSchema: ['UserSchema'],
  UserType: ['api__v1__meta__types__user'],
  OrgSettings: ['OrgSetting'],
  ...Object.fromEntries(
    Object.keys(POLICY_TYPE_NAME_TO_PARAMS).map(typeName => ([typeName, getPolicyItemsName(typeName)]))
  ),
  SmsTemplate: ['api__v1__templates__sms'],
  TrustedOrigin: ['api__v1__trustedOrigins'],
  NetworkZone: ['api__v1__zones'],
  Domain: ['DomainListResponse'],
  Role: ['RolePage'],
  BehaviorRule: ['api__v1__behaviors'],
}


export const DEFAULT_API_DEFINITIONS: OktaApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const DEFAULT_CONFIG: OktaConfig = {
  [FETCH_CONFIG]: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
}

export const configType = createMatchingObjectType<Partial<OktaConfig>>({
  elemID: new ElemID(OKTA),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(OKTA),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(
        OKTA,
      ),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createSwaggerAdapterApiConfigType({
        adapter: OKTA,
      }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(DEFAULT_CONFIG, API_DEFINITIONS_CONFIG, `${FETCH_CONFIG}.hideTypes`),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: OktaFetchConfig
  [API_DEFINITIONS_CONFIG]: OktaApiConfig
}
