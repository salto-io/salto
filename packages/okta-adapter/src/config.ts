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
import { ElemID, CORE_ANNOTATIONS, ActionName, BuiltinTypes, ObjectType, Field } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, elements } from '@salto-io/adapter-components'
import { ACCESS_POLICY_TYPE_NAME, CUSTOM_NAME_FIELD, IDP_POLICY_TYPE_NAME, MFA_POLICY_TYPE_NAME, OKTA, PASSWORD_POLICY_TYPE_NAME, PROFILE_ENROLLMENT_POLICY_TYPE_NAME, SIGN_ON_POLICY_TYPE_NAME } from './constants'

const { createUserFetchConfigType, createSwaggerAdapterApiConfigType, createDucktypeAdapterApiConfigType } = configUtils

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'
export const PRIVATE_API_DEFINITIONS_CONFIG = 'privateApiDefinitions'

export type OktaClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig> & {
  usePrivateAPI: boolean
}
export type OktaStatusActionName = 'activate' | 'deactivate'
export type OktaActionName = ActionName | OktaStatusActionName
export type OktaFetchConfig = configUtils.UserFetchConfig & {
  convertUsersIds?: boolean
  enableMissingReferences?: boolean
}

export type OktaSwaggerApiConfig = configUtils.AdapterSwaggerApiConfig<OktaActionName>
export type OktaDuckTypeApiConfig = configUtils.AdapterDuckTypeApiConfig

export type OktaConfig = {
  [CLIENT_CONFIG]?: OktaClientConfig
  [FETCH_CONFIG]: OktaFetchConfig
  [API_DEFINITIONS_CONFIG]: OktaSwaggerApiConfig
  [PRIVATE_API_DEFINITIONS_CONFIG]: OktaDuckTypeApiConfig
}

const DEFAULT_ID_FIELDS = ['name']
const DEFAULT_FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created' },
  { fieldName: 'lastUpdated' },
  { fieldName: 'createdBy' },
  { fieldName: 'lastUpdatedBy' },
]
const TRANSFORMATION_DEFAULTS: configUtils.TransformationDefaultConfig = {
  idFields: DEFAULT_ID_FIELDS,
  fieldsToOmit: DEFAULT_FIELDS_TO_OMIT,
  nestStandaloneInstances: true,
}

// Policy type is split to different kinds of policies
// The full list of policy types is taken from here:
// https://developer.okta.com/docs/reference/api/policy/#policy-types
type PolicyTypeNames = 'AccessPolicy' | 'IdentityProviderPolicy' | 'MultifactorEnrollmentPolicy' | 'OktaSignOnPolicy' | 'PasswordPolicy' | 'ProfileEnrollmentPolicy'

type PolicyParams = {
  queryParam: string
  ruleName: string
  policyServiceUrl: string
  ruleServiceUrl?: string
}

const POLICY_TYPE_NAME_TO_PARAMS: Record<PolicyTypeNames, PolicyParams> = {
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
}

const getPolicyItemsName = (policyName: string): string => (`${(policyName).slice(0, -1)}ies`)
const getPolicyRuleItemsName = (policyRuleName: string): string => (`${policyRuleName}s`)
const getPolicyConfig = (): OktaSwaggerApiConfig['types'] => {
  const policiesConfig = Object.entries(POLICY_TYPE_NAME_TO_PARAMS).map(([typeName, details]) => {
    const policyRuleConfig = {
      transformation: {
        serviceIdField: 'id',
        fieldsToHide: [{ fieldName: 'id' }],
        fieldTypeOverrides: [{ fieldName: '_links', fieldType: 'LinksSelf' }],
        fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
        serviceUrl: details.ruleServiceUrl ?? details.policyServiceUrl,
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
          serviceUrl: details.policyServiceUrl,
        },
        deployRequests: typeName !== IDP_POLICY_TYPE_NAME ? policyDeployRequests : undefined,
      },
      [details.ruleName]: policyRuleConfig,
    }
  })
  return Object.assign({}, ...policiesConfig)
}

const DEFAULT_TYPE_CUSTOMIZATIONS: OktaSwaggerApiConfig['types'] = {
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
        { fieldName: 'roles', fieldType: 'list<RoleAssignment>' },
        { fieldName: 'source', fieldType: 'Group__source' },
      ],
      fieldsToHide: [
        { fieldName: 'id' },
      ],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat([
        { fieldName: 'lastMembershipUpdated' },
        { fieldName: '_links' },
      ]),
      idFields: ['profile.name'],
      serviceIdField: 'id',
      serviceUrl: '/admin/group/{id}',
      standaloneFields: [{ fieldName: 'roles' }],
      nestStandaloneInstances: false,
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
          type: 'api__v1__apps___appId___groups@uuuuuu_00123_00125uu',
          toField: 'assignedGroups',
          context: [{ name: 'appId', fromField: 'id' }],
        },
        {
          type: 'AppUserSchema',
          toField: 'appUserSchema',
          context: [{ name: 'appId', fromField: 'id' }],
        },
      ],
    },
  },
  Application: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'name', fieldType: 'string' },
        { fieldName: CUSTOM_NAME_FIELD, fieldType: 'string' },
        { fieldName: 'credentials', fieldType: 'ApplicationCredentials' },
        { fieldName: 'settings', fieldType: 'unknown' },
        { fieldName: 'assignedGroups', fieldType: 'list<ApplicationGroupAssignment>' },
        { fieldName: 'profileEnrollment', fieldType: 'string' },
        { fieldName: 'accessPolicy', fieldType: 'string' },
        { fieldName: 'appUserSchema', fieldType: 'list<AppUserSchema>' },
      ],
      idFields: ['label'],
      serviceIdField: 'id',
      fieldsToHide: [
        { fieldName: CUSTOM_NAME_FIELD },
        { fieldName: 'id' },
        { fieldName: '_links' },
      ],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_embedded' }),
      serviceUrl: '/admin/app/{name}/instance/{id}/#tab-general',
      standaloneFields: [{ fieldName: 'appUserSchema' }],
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
  AppUserSchema: {
    request: {
      url: '/api/v1/meta/schemas/apps/{appId}/default',
    },
    transformation: {
      idFields: [],
      dataField: '.',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat(
        { fieldName: '$schema' },
        { fieldName: 'type' },
        { fieldName: 'properties' }
      ),
      fieldsToHide: [{ fieldName: 'id' }, { fieldName: 'name' }],
    },
    deployRequests: {
      modify: {
        url: '/api/v1/meta/schemas/apps/{applicationId}/default',
        method: 'post',
        urlParamsToFields: {
          applicationId: '_parent.0.id',
        },
      },
    },
  },
  UserSchemaPublic: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'properties', fieldType: 'Map<okta.UserSchemaAttribute>' },
      ],
    },
  },
  GroupSchemaCustom: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'properties', fieldType: 'Map<okta.GroupSchemaAttribute>' },
      ],
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
  ApplicationCredentials: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'oauthClient', fieldType: 'ApplicationCredentialsOAuthClient' },
        { fieldName: 'password', fieldType: 'PasswordCredential' },
        { fieldName: 'revealPassword', fieldType: 'boolean' },
        { fieldName: 'scheme', fieldType: 'string' },
        { fieldName: 'userName', fieldType: 'string' },
      ],
      fieldsToOmit: [{ fieldName: 'signing', fieldType: 'ApplicationCredentialsSigning' }],
    },
  },
  ApplicationVisibility: {
    transformation: {
      // The field cannot be changed and might include non multienv values
      fieldsToOmit: [{ fieldName: 'appLinks' }],
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
      serviceUrl: '/admin/access/identity-providers/edit/{id}',
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
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'userType', fieldType: 'string' },
      ],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT
        .concat({ fieldName: '_links' }, { fieldName: '$schema' }, { fieldName: 'type' }, { fieldName: 'title' }, { fieldName: 'description' }, { fieldName: 'properties' }),
      fieldsToHide: [{ fieldName: 'id' }, { fieldName: 'name' }],
      // serviceUrl is created in service_url filter
    },
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
      fieldsToHide: [{ fieldName: 'id' }, { fieldName: 'issuer' }],
      serviceIdField: 'id',
      standaloneFields: [{ fieldName: 'policies' }, { fieldName: 'scopes' }, { fieldName: 'claims' }],
      serviceUrl: '/admin/oauth2/as/{id}',
    },
  },
  AuthorizationServerCredentialsSigningConfig: {
    transformation: {
      fieldsToHide: [{ fieldName: 'kid' }, { fieldName: 'lastRotated' }, { fieldName: 'nextRotation' }],
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
    transformation: {
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      fieldTypeOverrides: [{ fieldName: '_links', fieldType: 'LinksSelf' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
    },
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
  api__v1__brands: {
    request: {
      url: '/api/v1/brands',
      recurseInto: [{
        type: 'api__v1__brands___brandId___themes@uuuuuu_00123_00125uu',
        toField: 'theme',
        context: [{ name: 'brandId', fromField: 'id' }],
      }],
    },
    transformation: {
      dataField: '.',
    },
  },
  'api__v1__brands___brandId___themes@uuuuuu_00123_00125uu': {
    request: {
      url: '/api/v1/brands/{brandId}/themes',
    },
    transformation: {
      dataField: '.',
    },
  },
  'api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu': {
    request: {
      url: '/api/v1/brands/{brandId}/templates/email',
      dependsOn: [{ pathParam: 'brandId', from: { type: 'api__v1__brands', field: 'id' } }],
    },
    transformation: {
      dataField: '.',
    },
  },
  GroupSchema: {
    transformation: {
      idFields: ['title'],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat(
        { fieldName: '_links' },
        { fieldName: '$schema' }
      ),
      fieldsToHide: [{ fieldName: 'id' }],
    },
    deployRequests: {
      modify: {
        url: '/api/v1/meta/schemas/group/default',
        method: 'post',
      },
    },
  },
  Domain: {
    transformation: {
      isSingleton: true,
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
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
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/api/v1/org',
        method: 'put',
        fieldsToIgnore: ['contactTypes'],
      },
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
      standaloneFields: [{ fieldName: 'theme' }],
      nestStandaloneInstances: false,
      fieldTypeOverrides: [{ fieldName: 'theme', fieldType: 'list<BrandTheme>' }],
      serviceUrl: '/admin/customizations/footer',
    },
    deployRequests: {
      modify: {
        url: '/api/v1/brands/{brandId}',
        method: 'put',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
    },
  },
  BrandTheme: {
    transformation: {
      isSingleton: true,
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      serviceUrl: '/admin/customizations/branding',
    },
    deployRequests: {
      modify: {
        url: '/api/v1/brands/{brandId}/themes/{themeId}',
        method: 'put',
        urlParamsToFields: {
          brandId: '_parent.0.id',
          themeId: 'id',
        },
        fieldsToIgnore: ['id', 'logo', 'favicon'],
      },
    },
  },
  EmailTemplate: {
    transformation: {
      serviceIdField: 'name',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
    },
  },
  Authenticator: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
      serviceUrl: '/admin/access/multifactor#policies',
    },
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
  EventHook: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
      serviceUrl: '/admin/workflow/eventhooks',
    },
  },
  GroupRule: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'allGroupsValid', fieldType: 'boolean' }],
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
      serviceUrl: '/admin/groups#rules',
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
      serviceUrl: '/admin/workflow/inlinehooks#view/{id}',
    },
  },
  NetworkZone: {
    transformation: {
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
      serviceUrl: '/admin/access/networks',
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
      serviceUrl: '/admin/access/api/trusted_origins',
    },
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
    transformation: {
      serviceIdField: 'id',
      fieldsToHide: [
        { fieldName: 'id' },
        { fieldName: '_links' },
      ],
      serviceUrl: 'admin/universaldirectory#okta/{id}',
    },
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
      },
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
  IamRoles: {
    request: {
      url: '/api/v1/iam/roles',
    },
    transformation: {
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
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  OAuth2Claim: {
    transformation: {
      fieldsToOmit: [
        { fieldName: '_links' },
      ],
      serviceIdField: 'id',
      fieldsToHide: [{ fieldName: 'id' }],
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
      serviceIdField: 'id',
      fieldTypeOverrides: [{ fieldName: '_links', fieldType: 'LinksSelf' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      serviceUrl: '/admin/access/behaviors',
    },
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
    request: {
      url: '/api/v1/rate-limit-settings/per-client',
    },
    transformation: {
      isSingleton: true,
      dataField: '.',
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/api/v1/rate-limit-settings/per-client',
        method: 'put',
      },
    },
  },
  RateLimitAdminNotifications: {
    request: {
      url: '/api/v1/rate-limit-settings/admin-notifications',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/api/v1/rate-limit-settings/admin-notifications',
        method: 'put',
      },
    },
  },
  ProfileEnrollmentPolicyRuleProfileAttribute: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'name', fieldType: 'UserSchemaAttribute' }],
    },
  },
  RoleAssignment: {
    transformation: {
      idFields: ['label'],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
      fieldTypeOverrides: [
        { fieldName: 'resource-set', fieldType: 'string' },
        { fieldName: 'role', fieldType: 'string' },
      ],
      extendsParentId: true,
    },
    deployRequests: {
      add: {
        url: '/api/v1/groups/{groupId}/roles',
        method: 'post',
        urlParamsToFields: {
          groupId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v1/groups/{groupId}/roles/{roleId}',
        method: 'delete',
        urlParamsToFields: {
          groupId: '_parent.0.id',
          roleId: 'id',
        },
      },
    },
  },
  ResourceSets: {
    request: {
      url: '/api/v1/iam/resource-sets',
    },
    transformation: {
      dataField: 'resource-sets',
    },
  },
  ResourceSetResources: {
    request: {
      url: '/api/v1/iam/resource-sets/{resourceSetId}/resources',
    },
    transformation: {
      dataField: 'resources',
    },
  },
  ResourceSet: {
    transformation: {
      idFields: ['label'],
      serviceIdField: 'id',
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat({ fieldName: '_links' }),
      fieldsToHide: [{ fieldName: 'id' }],
    },
  },
  ProfileEnrollmentPolicyRuleAction: {
    transformation: {
      // TODO: should change to reference in SALTO-3806
      fieldTypeOverrides: [{ fieldName: 'uiSchemaId', fieldType: 'string' }],
      fieldsToHide: [{ fieldName: 'uiSchemaId' }],
    },
  },
  DevicePolicyRuleCondition: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'registered', fieldType: 'boolean' },
        { fieldName: 'managed', fieldType: 'boolean' },
        { fieldName: 'assurance', fieldType: 'DeviceCondition' },
      ],
    },
  },
  DeviceAssurance: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'lastUpdate', fieldType: 'string' }],
      fieldsToHide: [{ fieldName: 'id' }],
      fieldsToOmit: DEFAULT_FIELDS_TO_OMIT.concat([{ fieldName: 'createdDate' }, { fieldName: 'lastUpdate' }, { fieldName: '_links' }]),
    },
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
      },
    },
  },
}

const DEFAULT_SWAGGER_CONFIG: OktaSwaggerApiConfig['swagger'] = {
  url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/okta/management-swagger-v3.yaml',
  additionalTypes: [
    ...Object.keys(POLICY_TYPE_NAME_TO_PARAMS)
      .map(policyTypeName => ({ typeName: getPolicyItemsName(policyTypeName), cloneFrom: 'api__v1__policies' })),
    ...Object.values(POLICY_TYPE_NAME_TO_PARAMS)
      .map(policy => ({ typeName: getPolicyRuleItemsName(policy.ruleName), cloneFrom: 'api__v1__policies___policyId___rules@uuuuuu_00123_00125uu' })),
    // IdentityProviderPolicy and MultifactorEnrollmentPolicy don't have their own 'rule' type.
    { typeName: 'IdentityProviderPolicyRule', cloneFrom: 'PolicyRule' },
    { typeName: 'MultifactorEnrollmentPolicyRule', cloneFrom: 'PolicyRule' },
    // AppUserSchema returns UserSchema items, but we separate types because the endpoints for deploy are different
    { typeName: 'AppUserSchema', cloneFrom: 'UserSchema' },
    // This is not the right type to cloneFrom, but a workaround to define type for Group__source with 'id' field
    { typeName: 'Group__source', cloneFrom: 'AppAndInstanceConditionEvaluatorAppOrInstance' },
    { typeName: 'DeviceCondition', cloneFrom: 'PolicyNetworkCondition' },
  ],
  typeNameOverrides: [
    { originalName: 'DomainResponse', newName: 'Domain' },
    { originalName: 'ThemeResponse', newName: 'BrandTheme' },
    { originalName: 'Role', newName: 'RoleAssignment' },
    { originalName: 'IamRole', newName: 'Role' },
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
  BrandTheme: ['api__v1__brands___brandId___themes@uuuuuu_00123_00125uu'],
  EmailTemplate: ['api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu'],
  EventHook: ['api__v1__eventHooks'],
  Feature: ['api__v1__features'],
  Group: ['api__v1__groups'],
  RoleAssignment: ['api__v1__groups___groupId___roles@uuuuuu_00123_00125uu'],
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
    Object.keys(POLICY_TYPE_NAME_TO_PARAMS).map(typeName => ([typeName, [getPolicyItemsName(typeName)]]))
  ),
  SmsTemplate: ['api__v1__templates__sms'],
  TrustedOrigin: ['api__v1__trustedOrigins'],
  NetworkZone: ['api__v1__zones'],
  Domain: ['DomainListResponse'],
  Role: ['IamRoles'],
  BehaviorRule: ['api__v1__behaviors'],
  PerClientRateLimit: ['PerClientRateLimitSettings'],
  RateLimitAdmin: ['RateLimitAdminNotifications'],
  ResourceSet: ['ResourceSets'],
  DeviceAssurance: ['api__v1__device_assurances@uuuub'],
}

const DUCKTYPE_TYPES: OktaDuckTypeApiConfig['types'] = {
  EmailNotifications: {
    request: {
      url: '/api/internal/email-notifications',
    },
    transformation: {
      isSingleton: true,
      fieldsToHide: [{ fieldName: 'id' }],
      dataField: '.',
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/email-notifications',
        method: 'put',
      },
    },
  },
  EndUserSupport: {
    request: {
      url: '/api/internal/enduser-support',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/enduser-support',
        method: 'post',
      },
    },
  },
  ThirdPartyAdmin: {
    request: {
      url: '/api/internal/orgSettings/thirdPartyAdminSetting',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/orgSettings/thirdPartyAdminSetting',
        method: 'post',
      },
    },
  },
  EmbeddedSignInSuppport: {
    request: {
      url: '/admin/api/v1/embedded-login-settings',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/settings/account',
    },
    deployRequests: {
      modify: {
        url: '/admin/api/v1/embedded-login-settings',
        method: 'post',
      },
    },
  },
  SignOutPage: {
    request: {
      url: '/api/internal/org/settings/signout-page',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/customizations/other',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/signout-page',
        method: 'post',
      },
    },
  },
  BrowserPlugin: {
    request: {
      url: '/api/internal/org/settings/browserplugin',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/customizations/other',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/browserplugin',
        method: 'post',
      },
    },
  },
  DisplayLanguage: {
    request: {
      url: '/api/internal/org/settings/locale',
    },
    transformation: {
      dataField: '.',
      isSingleton: true,
      serviceUrl: '/admin/customizations/other',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/locale',
        method: 'post',
      },
    },
  },
  Reauthentication: {
    request: {
      url: '/api/internal/org/settings/reauth-expiration',
    },
    transformation: {
      isSingleton: true,
      serviceUrl: '/admin/customizations/other',
    },
    deployRequests: {
      modify: {
        url: '/api/internal/org/settings/reauth-expiration',
        method: 'post',
      },
    },
  },
}

export const DUCKTYPE_SUPPORTED_TYPES = {
  EmailNotificationSettings: ['EmailNotifications'],
  EndUserSupportSettings: ['EndUserSupport'],
  ThirdPartyAdminSettings: ['ThirdPartyAdmin'],
  EmbeddedSignInSuppportSettings: ['EmbeddedSignInSuppport'],
  SignOutPageSettings: ['SignOutPage'],
  BrowserPluginSettings: ['BrowserPlugin'],
  DisplayLanguageSettings: ['DisplayLanguage'],
  ReauthenticationSettings: ['Reauthentication'],
}

export const DUCKTYPE_API_DEFINITIONS: OktaDuckTypeApiConfig = {
  typeDefaults: {
    transformation: TRANSFORMATION_DEFAULTS,
  },
  types: DUCKTYPE_TYPES,
  supportedTypes: DUCKTYPE_SUPPORTED_TYPES,
}

export const DEFAULT_API_DEFINITIONS: OktaSwaggerApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: TRANSFORMATION_DEFAULTS,
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const DEFAULT_CONFIG: OktaConfig = {
  [FETCH_CONFIG]: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
    convertUsersIds: true,
    enableMissingReferences: true,
  },
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
  [PRIVATE_API_DEFINITIONS_CONFIG]: DUCKTYPE_API_DEFINITIONS,
  [CLIENT_CONFIG]: {
    usePrivateAPI: true,
  },
}

const createClientConfigType = (): ObjectType => {
  const configType = clientUtils.createClientConfigType(OKTA)
  configType.fields.usePrivateAPI = new Field(
    configType, 'usePrivateAPI', BuiltinTypes.BOOLEAN
  )
  return configType
}

export const configType = createMatchingObjectType<Partial<OktaConfig>>({
  elemID: new ElemID(OKTA),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(
        OKTA,
        {
          convertUsersIds: { refType: BuiltinTypes.BOOLEAN },
          enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
        }
      ),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createSwaggerAdapterApiConfigType({
        adapter: OKTA,
        elemIdPrefix: 'swagger',
      }),
    },
    [PRIVATE_API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({
        adapter: OKTA,
        elemIdPrefix: 'ducktype',
      }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(
      DEFAULT_CONFIG,
      API_DEFINITIONS_CONFIG,
      PRIVATE_API_DEFINITIONS_CONFIG,
      CLIENT_CONFIG,
      `${FETCH_CONFIG}.hideTypes`,
      `${FETCH_CONFIG}.convertUsersIds`,
      `${FETCH_CONFIG}.enableMissingReferences`,
    ),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: OktaFetchConfig
  [API_DEFINITIONS_CONFIG]: OktaSwaggerApiConfig
  [PRIVATE_API_DEFINITIONS_CONFIG]: OktaDuckTypeApiConfig
}
