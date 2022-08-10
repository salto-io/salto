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
        // TODON both of these should be references instead! can copy from another adapter?
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
      ],
    },
  },
  api__v1__apps: {
    request: {
      url: '/api/v1/apps',
      recurseInto: [
        {
          // app user is different from user! check about others, may only need to convert
          // part of the reference
          type: 'api__v1__apps___appId___users@uuuuuu_00123_00125uu',
          toField: 'appUsers',
          context: [{ name: 'appId', fromField: 'id' }],
        },
        {
          type: 'api__v1__apps___appId___credentials__csrs@uuuuuu_00123_00125uuuu',
          toField: 'CSRs',
          context: [{ name: 'appId', fromField: 'id' }],
        },
        // returns 429 - need to investigate
        // {
        //   type: 'api__v1__apps___appId___credentials__keys@uuuuuu_00123_00125uuuu',
        //   toField: 'jsonWebKeys',
        //   context: [{ name: 'appId', fromField: 'id' }],
        // },
        {
          type: 'api__v1__apps___appId___grants@uuuuuu_00123_00125uu',
          toField: 'oAuth2ScopeConsentGrants',
          context: [{ name: 'appId', fromField: 'id' }],
        },
      ],
    },
  },
  api__v1__meta__types__user: {
    transformation: {
      // by default there is an unwanted traversal here
      dataField: '.',
    },
  },
}

const DEFAULT_SWAGGER_CONFIG: OktaApiConfig['swagger'] = {
  url: 'https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/spec.yaml',
}

/* eslint-disable max-len */
export const SUPPORTED_TYPES = {
  Application: [
    'api__v1__apps',
    // 'api__v1__groups___groupId___apps@uuuuuu_00123_00125uu',
  ],
  // need by parent app
  // Csr: [
  //   'api__v1__apps___appId___credentials__csrs@uuuuuu_00123_00125uuuu', // covered
  //   'api__v1__idps___idpId___credentials__csrs@uuuuuu_00123_00125uuuu', // TODO add
  // ],
  // JsonWebKey: [
  //   'api__v1__apps___appId___credentials__keys@uuuuuu_00123_00125uuuu', // covered
  //   'api__v1__authorizationServers___authServerId___credentials__keys@uuuuuu_00123_00125uuuu',
  //   'api__v1__idps___idpId___credentials__keys@uuuuuu_00123_00125uuuu',
  //   'api__v1__idps__credentials__keys',
  // ],
  // ApplicationFeature: ['api__v1__apps___appId___features@uuuuuu_00123_00125uu'],
  // OAuth2ScopeConsentGrant: [
  //   'api__v1__apps___appId___grants@uuuuuu_00123_00125uu', // covered
  //   'api__v1__users___userId___clients___clientId___grants@uuuuuu_00123_00125uuuu_00123_00125uu',
  //   'api__v1__users___userId___grants@uuuuuu_00123_00125uu',
  // ],
  // ApplicationGroupAssignment: ['api__v1__apps___appId___groups@uuuuuu_00123_00125uu'],
  // OAuth2Token: ['api__v1__apps___appId___tokens@uuuuuu_00123_00125uu'],
  // AppUser: ['api__v1__apps___appId___users@uuuuuu_00123_00125uu'],
  Authenticator: ['api__v1__authenticators'],
  AuthorizationServer: ['api__v1__authorizationServers'],
  // OAuth2Claim: [
  //   'api__v1__authorizationServers___authServerId___claims@uuuuuu_00123_00125uu',
  // ],
  // OAuth2Client: [
  //   'api__v1__authorizationServers___authServerId___clients@uuuuuu_00123_00125uu',
  //   'api__v1__users___userId___clients@uuuuuu_00123_00125uu',
  // ],
  // OAuth2RefreshToken: [
  //   'api__v1__authorizationServers___authServerId___clients___clientId___tokens@uuuuuu_00123_00125uuuu_00123_00125uu',
  //   'api__v1__users___userId___clients___clientId___tokens@uuuuuu_00123_00125uuuu_00123_00125uu',
  // ],
  // AuthorizationServerPolicy: [
  //   'api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu',
  // ],
  // AuthorizationServerPolicyRule: [
  //   'api__v1__authorizationServers___authServerId___policies___policyId___rules@uuuuuu_00123_00125uuuu_00123_00125uu',
  // ],
  // OAuth2Scope: [
  //   'api__v1__authorizationServers___authServerId___scopes@uuuuuu_00123_00125uu',
  // ],
  Brand: ['api__v1__brands'],
  // EmailTemplate: [
  //   'api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu',
  // ],
  // EmailTemplateCustomization: [
  //   'api__v1__brands___brandId___templates__email___templateName___customizations@uuuuuu_00123_00125uuuuuu_00123_00125uu',
  // ],
  // ThemeResponse: ['api__v1__brands___brandId___themes@uuuuuu_00123_00125uu'],
  EventHook: ['api__v1__eventHooks'],
  Feature: [
    'api__v1__features',
    // TODO
    // 'api__v1__features___featureId___dependencies@uuuuuu_00123_00125uu',
    // 'api__v1__features___featureId___dependents@uuuuuu_00123_00125uu',
  ],
  Group: [
    'api__v1__groups',
    // 'api__v1__groups___groupId___roles___roleId___targets__groups@uuuuuu_00123_00125uuuu_00123_00125uuuu',
    // 'api__v1__users___userId___groups@uuuuuu_00123_00125uu',
    // 'api__v1__users___userId___roles___roleId___targets__groups@uuuuuu_00123_00125uuuu_00123_00125uuuu',
  ],
  // Role: [
  //   'api__v1__groups___groupId___roles@uuuuuu_00123_00125uu',
  //   'api__v1__users___userId___roles@uuuuuu_00123_00125uu',
  // ],
  // CatalogApplication: [
  //   'api__v1__groups___groupId___roles___roleId___targets__catalog__apps@uuuuuu_00123_00125uuuu_00123_00125uuuuuu',
  //   'api__v1__users___userId___roles___roleId___targets__catalog__apps@uuuuuu_00123_00125uuuu_00123_00125uuuuuu',
  // ],
  User: [
    'api__v1__users',
  ],
  GroupRule: ['api__v1__groups__rules'],
  IdentityProvider: [
    'api__v1__idps',
    // 'api__v1__users___userId___idps@uuuuuu_00123_00125uu',
  ],
  // IdentityProviderApplicationUser: ['api__v1__idps___idpId___users@uuuuuu_00123_00125uu'],
  // SocialAuthToken: [
  //   'api__v1__idps___idpId___users___userId___credentials__tokens@uuuuuu_00123_00125uuuu_00123_00125uuuu',
  // ],
  InlineHook: ['api__v1__inlineHooks'],
  LogEvent: ['api__v1__logs'],
  ProfileMapping: ['api__v1__mappings'],
  LinkedObject: ['api__v1__meta__schemas__user__linkedObjects'],
  UserType: ['api__v1__meta__types__user'],
  OrgContactTypeObj: ['api__v1__org__contacts'],
  Policy: ['api__v1__policies'],
  // PolicyRule: ['api__v1__policies___policyId___rules@uuuuuu_00123_00125uu'],
  // Subscription: [
  //   'api__v1__roles___roleTypeOrRoleId___subscriptions@uuuuuu_00123_00125uu',
  //   'api__v1__users___userId___subscriptions@uuuuuu_00123_00125uu',
  // ],
  SmsTemplate: ['api__v1__templates__sms'],
  TrustedOrigin: ['api__v1__trustedOrigins'],
  // AppLink: ['api__v1__users___userId___appLinks@uuuuuu_00123_00125uu'],
  // UserFactor: [
  //   'api__v1__users___userId___factors@uuuuuu_00123_00125uu',
  //   'api__v1__users___userId___factors__catalog@uuuuuu_00123_00125uuuu',
  // ],
  // SecurityQuestion: [
  //   'api__v1__users___userId___factors__questions@uuuuuu_00123_00125uuuu',
  // ],
  // ResponseLinks: [
  //   'api__v1__users___userId___linkedObjects___relationshipName_@uuuuuu_00123_00125uuuu_00123_00125',
  // ],
  NetworkZone: ['api__v1__zones'],
}


export const DEFAULT_API_DEFINITIONS: OktaApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
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
