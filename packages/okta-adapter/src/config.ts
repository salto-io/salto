/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, elements } from '@salto-io/adapter-components'
import { OKTA } from './constants'

const { createClientConfigType } = clientUtils
const { createUserFetchConfigType, createSwaggerAdapterApiConfigType } = configUtils

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type OktaClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type OktaFetchConfig = configUtils.UserFetchConfig
export type OktaApiConfig = configUtils.AdapterSwaggerApiConfig & {
  settingsSwagger?: {
    typeNameOverrides?: configUtils.TypeNameOverrideConfig[]
  }
}

export type OktaConfig = {
  [CLIENT_CONFIG]?: OktaClientConfig
  [FETCH_CONFIG]: OktaFetchConfig
  [API_DEFINITIONS_CONFIG]: OktaApiConfig
}

const DEFAULT_ID_FIELDS = ['name']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  // TODO
]

const DEFAULT_TYPE_CUSTOMIZATIONS: OktaApiConfig['types'] = {
  api__v1__groups: {
    request: {
      url: '/api/v1/groups',
      recurseInto: [
        {
          type: 'api__v1__groups___groupId___apps@uuuuuu_00123_00125uu',
          toField: 'apps',
          context: [{ name: 'groupId', fromField: 'id' }],
        },
        {
          type: 'api__v1__groups___groupId___users@uuuuuu_00123_00125uu',
          toField: 'users',
          context: [{ name: 'groupId', fromField: 'id' }],
        },
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
        { fieldName: 'users', fieldType: 'list<User>' },
        { fieldName: 'roles', fieldType: 'list<Role>' },
      ],
      idFields: ['profile.name'],
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
    },
  },
  api__v1__apps: {
    request: {
      url: '/api/v1/apps',
      recurseInto: [
        // TODO after SALTO-2615 we can uncomment the types that might fail
        {
          type: 'api__v1__apps___appId___users@uuuuuu_00123_00125uu',
          toField: 'appUsers',
          context: [{ name: 'appId', fromField: 'id' }],
        },
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
        // can return 400 depends on users definitions
        // {
        //   type: 'api__v1__apps___appId___features@uuuuuu_00123_00125uu',
        //   toField: 'appFeatures',
        //   context: [{ name: 'appId', fromField: 'id' }],
        // },
        // TODO figure out if we want to indclude JWK
        // {
        //   type: 'api__v1__apps___appId___credentials__keys@uuuuuu_00123_00125uuuu',
        //   toField: 'jsonWebKeys',
        //   context: [{ name: 'appId', fromField: 'id' }],
        // },
        // returns for some instances 429 - need to investigate
        // {
        //   type: 'api__v1__apps___appId___grants@uuuuuu_00123_00125uu',
        //   toField: 'oAuth2ScopeConsentGrants',
        //   context: [{ name: 'appId', fromField: 'id' }],
        // },
        // return 500 - need to investigate
        // {
        //   type: 'api__v1__apps___appId___tokens@uuuuuu_00123_00125uu',
        //   toField: 'OAuth2Tokens',
        //   context: [{ name: 'appId', fromField: 'id' }],
        // },
      ],
    },
  },
  Application: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'appUsers', fieldType: 'list<AppUser>' },
        { fieldName: 'CSRs', fieldType: 'list<Csr>' },
        { fieldName: 'assignedGroups', fieldType: 'list<ApplicationGroupAssignment>' },
      ],
      // TODO SALTO-2644
      idFields: ['name', 'status'],
    },
  },
  'api__v1__apps___appId___credentials__keys@uuuuuu_00123_00125uuuu': {
    transformation: {
      dataField: '.',
    },
  },
  api__v1__meta__types__user: {
    transformation: {
      // by default there is an unwanted traversal here
      dataField: '.',
    },
  },
  api__v1__users: {
    request: {
      url: 'api/v1/users',
      recurseInto: [
        {
          type: 'api__v1__users___userId___roles@uuuuuu_00123_00125uu',
          toField: 'roles',
          context: [{ name: 'userId', fromField: 'id' }],
        },
      ],
    },
  },
  api__v1__idps: {
    request: {
      url: 'api/v1/idps',
      recurseInto: [
        {
          type: 'api__v1__idps___idpId___users@uuuuuu_00123_00125uu',
          toField: 'users',
          context: [{ name: 'idpId', fromField: 'id' }],
        },
        {
          type: 'api__v1__idps___idpId___credentials__csrs@uuuuuu_00123_00125uuuu',
          toField: 'CSRs',
          context: [{ name: 'idpId', fromField: 'id' }],
        },
        // TODO figure out if we want to indclude JWK
        // {
        //   type: 'api__v1__idps___idpId___credentials__keys@uuuuuu_00123_00125uuuu',
        //   toField: 'jsonWebKeys',
        //   context: [{ name: 'idpId', fromField: 'id' }],
        // },
      ],
    },
  },
  IdentityProvider: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'users', fieldType: 'list<IdentityProviderApplicationUser>' },
        { fieldName: 'CSRs', fieldType: 'list<Csr>' },
      ],
    },
  },
  api__v1__features: {
    request: {
      url: 'api/v1/features',
      recurseInto: [
        {
          // Features that needs to be enabled in order to enable the feature
          type: 'api__v1__features___featureId___dependencies@uuuuuu_00123_00125uu',
          toField: 'featureDependencies',
          context: [{ name: 'featureId', fromField: 'id' }],
        },
        {
          // Features that needs to be disabled in order to enable the feature
          type: 'api__v1__features___featureId___dependents@uuuuuu_00123_00125uu',
          toField: 'featureDependents',
          context: [{ name: 'featureId', fromField: 'id' }],
        },
      ],
    },
  },
  Feature: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'featureDependencies', fieldType: 'list<Feature>' },
        { fieldName: 'featureDependents', fieldType: 'list<Feature>' },
      ],
    },
  },
  AuthenticatorEnrollmentPolicies: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'MFA_ENROLL',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  GlobalSessionPolicies: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'OKTA_SIGN_ON',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  AuthenticationPolicies: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'ACCESS_POLICY',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  ProfileEnrollmentPolicies: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'PROFILE_ENROLLMENT',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  IdentityProviderRoutingRules: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'IDP_DISCOVERY',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  PasswordPolicies: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'PASSWORD',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  // TODO returns 400 bad request
  OAuthAuthorizationPolicies: {
    request: {
      url: '/api/v1/policies',
      queryParams: {
        type: 'OAUTH_AUTHORIZATION_POLICY',
      },
      recurseInto: [
        {
          type: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu',
          toField: 'policyRules',
          context: [{ name: 'policyId', fromField: 'id' }],
        },
      ],
    },
  },
  UserSchema: {
    request: {
      url: '/api/v1/meta/schemas/user/default',
    },
  },
  User: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'roles', fieldType: 'list<Role>' },
      ],
      idFields: ['profile.firstName', 'profile.lastName'],
      fieldsToOmit: [
        { fieldName: 'lastLogin' },
      ],
    },
  },
  Policy: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'policyRules', fieldType: 'list<PolicyRule>' },
      ],
      idFields: ['name', 'type'],
    },
  },
  OrgContactTypeObj: {
    transformation: {
      idFields: ['contactType'],
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
        // TODO figure out if we want to indclude JWK
        /* eslint-disable max-len */
        // {
        //   type: 'api__v1__authorizationServers___authServerId___credentials__keys@uuuuuu_00123_00125uuuu',
        //   toField: 'jsonWebKeys',
        //   context: [{ name: 'authServerId', fromField: 'id' }],
        // },
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
  // TODO we need to figure out if we to include tokens
  /* eslint-disable max-len */
  // 'api__v1__authorizationServers___authServerId___clients@uuuuuu_00123_00125uu': {
  //   request: {
  //     url: '/api/v1/authorizationServers/{authServerId}/clients',
  //     recurseInto: [
  //       {
  //         type: 'api__v1__authorizationServers___authServerId___clients___clientId___tokens@uuuuuu_00123_00125uuuu_00123_00125uu',
  //         toField: 'OAuth2Tokens',
  //         context: [{ name: 'clientId', fromField: 'id' }],
  //       },
  //     ],
  //   },
  // },
  AuthorizationServer: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'scopes', fieldType: 'list<OAuth2Scope>' },
        { fieldName: 'claims', fieldType: 'list<OAuth2Claim>' },
        { fieldName: 'policies', fieldType: 'list<AuthorizationServerPolicy>' },
        { fieldName: 'clients', fieldType: 'list<OAuth2Client>' },
      ],
    },
  },
  AuthorizationServerPolicy: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'policyRules', fieldType: 'list<AuthorizationServerPolicyRule>' },
      ],
    },
  },
  // TODO figure out if we want to indclude JWK
  // 'api__v1__authorizationServers___authServerId___credentials__keys@uuuuuu_00123_00125uuuu': {
  //   transformation: {
  //     dataField: '.',
  //   },
  // },
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
  'api__v1__idps___idpId___credentials__keys@uuuuuu_00123_00125uuuu': {
    transformation: {
      dataField: '.',
    },
  },
  GroupSchema: {
    transformation: {
      idFields: ['title'],
    },
  },
  Domain: {
    transformation: {
      isSingleton: true,
    },
  },
  OrgSetting: {
    transformation: {
      isSingleton: true,
    },
  },
  Brand: {
    transformation: {
      isSingleton: true,
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
}

const DEFAULT_SWAGGER_CONFIG: OktaApiConfig['swagger'] = {
  url: 'https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/spec.yaml',
  additionalTypes: [
    { typeName: 'AuthenticatorEnrollmentPolicies', cloneFrom: 'api__v1__policies' },
    { typeName: 'GlobalSessionPolicies', cloneFrom: 'api__v1__policies' },
    { typeName: 'AuthenticationPolicies', cloneFrom: 'api__v1__policies' },
    { typeName: 'ProfileEnrollmentPolicies', cloneFrom: 'api__v1__policies' },
    { typeName: 'IdentityProviderRoutingRules', cloneFrom: 'api__v1__policies' },
    { typeName: 'PasswordPolicies', cloneFrom: 'api__v1__policies' },
    { typeName: 'OAuthAuthorizationPolicies', cloneFrom: 'api__v1__policies' },
    // TODO this is not the right type to clone from, another solution is needed
    { typeName: 'RolePage', cloneFrom: 'api__v1__groups___groupId___roles@uuuuuu_00123_00125uu' },
  ],
}

/* eslint-disable max-len */
export const SUPPORTED_TYPES = {
  Application: [
    'api__v1__apps',
  ],
  IdentityProviderJsonWebKey: [
    'api__v1__idps__credentials__keys',
  ],
  Authenticator: ['api__v1__authenticators'],
  AuthorizationServer: ['api__v1__authorizationServers'],
  Brand: ['api__v1__brands'],
  EventHook: ['api__v1__eventHooks'],
  Feature: ['api__v1__features'],
  Group: [
    'api__v1__groups',
  ],
  User: [
    'api__v1__users',
  ],
  GroupRule: ['api__v1__groups__rules'],
  IdentityProvider: [
    'api__v1__idps',
  ],
  InlineHook: ['api__v1__inlineHooks'],
  // TODO returns 401
  ProfileMapping: ['api__v1__mappings'],
  LinkedObjectDefinitions: ['api__v1__meta__schemas__user__linkedObjects'],
  GroupSchema: ['GroupSchema'],
  UserSchema: ['UserSchema'],
  UserType: ['api__v1__meta__types__user'],
  OrgContactTypeObj: ['api__v1__org__contacts'],
  OrgSettings: ['OrgSetting'],
  Policy: [
    'AuthenticatorEnrollmentPolicies',
    'GlobalSessionPolicies',
    'AuthenticationPolicies',
    'ProfileEnrollmentPolicies',
    'IdentityProviderRoutingRules',
    'PasswordPolicies',
    'OAuthAuthorizationPolicies',
  ],
  SmsTemplate: ['api__v1__templates__sms'],
  TrustedOrigin: ['api__v1__trustedOrigins'],
  NetworkZone: ['api__v1__zones'],
  Domain: ['DomainListResponse'],
  Role: ['RolePage'],
}


export const DEFAULT_API_DEFINITIONS: OktaApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
      // TODO: currently these fields can be nested
      // fieldsToHide: [
      //   { fieldName: 'created', fieldType: 'string' },
      //   { fieldName: 'lastUpdated', fieldType: 'string' },
      //   { fieldName: 'lastLogin', fieldType: 'string' },
      //   { fieldName: '_links', fieldType: 'string' },
      // ],
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const DEFAULT_CONFIG: OktaConfig = {
  [FETCH_CONFIG]: elements.query.INCLUDE_ALL_CONFIG,
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
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(DEFAULT_CONFIG, API_DEFINITIONS_CONFIG),
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: OktaFetchConfig
  [API_DEFINITIONS_CONFIG]: OktaApiConfig
}
