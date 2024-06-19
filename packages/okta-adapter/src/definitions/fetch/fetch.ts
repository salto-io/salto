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
import _ from 'lodash'
import { naclCase } from '@salto-io/adapter-utils'
import { definitions, fetch as fetchUtils, client as clientUtils } from '@salto-io/adapter-components'
import { POLICY_TYPE_NAME_TO_PARAMS } from '../../config'
import { OktaFetchOptions } from '../types'
import { OktaUserConfig } from '../../user_config'
import {
  ACCESS_POLICY_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  CUSTOM_NAME_FIELD,
  MFA_RULE_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  DEVICE_ASSURANCE,
  AUTHENTICATOR_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
} from '../../constants'
import { isGroupPushEntry } from '../../filters/group_push'
import { extractSchemaIdFromUserType } from './types/user_type'
import { isNotMappingToAuthenticatorApp } from './types/profile_mapping'
import { assignPolicyIdsToApplication } from './types/application'
import { OMIT_CREDS_HEADER } from '../../user_utils'

const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created: { omit: true },
  lastUpdated: { omit: true },
  createdBy: { omit: true },
  lastUpdatedBy: { omit: true },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_OMIT,
)

const getPrivateAPICustomizations = ({
  endpoint,
  serviceUrl,
}: {
  endpoint: definitions.EndpointPath
  serviceUrl: string
}): definitions.fetch.InstanceFetchApiDefinitions<OktaFetchOptions> => ({
  requests: [{ endpoint: { path: endpoint, client: 'private' } }],
  resource: { directFetch: true },
  element: {
    topLevel: {
      isTopLevel: true,
      singleton: true,
      serviceUrl: { path: serviceUrl },
    },
    fieldCustomizations: { id: { hide: true } },
  },
})

const getPrivateAPISettingsDefinitions = ({
  usePrivateAPI,
}: {
  usePrivateAPI: boolean
}): Record<string, definitions.fetch.InstanceFetchApiDefinitions<OktaFetchOptions>> => {
  if (!usePrivateAPI) {
    return {}
  }
  return {
    EmailNotifications: getPrivateAPICustomizations({
      endpoint: '/api/internal/email-notifications',
      serviceUrl: '/admin/settings/account',
    }),
    EndUserSupport: getPrivateAPICustomizations({
      endpoint: '/api/internal/enduser-support',
      serviceUrl: '/admin/settings/account',
    }),
    ThirdPartyAdmin: getPrivateAPICustomizations({
      endpoint: '/api/internal/orgSettings/thirdPartyAdminSetting',
      serviceUrl: '/admin/settings/account',
    }),
    EmbeddedSignInSuppport: getPrivateAPICustomizations({
      endpoint: '/admin/api/v1/embedded-login-settings',
      serviceUrl: '/admin/settings/account',
    }),
    SignOutPage: getPrivateAPICustomizations({
      endpoint: '/api/internal/org/settings/signout-page',
      serviceUrl: '/admin/customizations/other',
    }),
    BrowserPlugin: getPrivateAPICustomizations({
      endpoint: '/api/internal/org/settings/browserplugin',
      serviceUrl: '/admin/customizations/other',
    }),
    DisplayLanguage: getPrivateAPICustomizations({
      endpoint: '/api/internal/org/settings/locale',
      serviceUrl: '/admin/customizations/other',
    }),
    Reauthentication: getPrivateAPICustomizations({
      endpoint: '/api/internal/org/settings/reauth-expiration',
      serviceUrl: '/admin/customizations/other',
    }),
  }
}

const accessPolicyCustomizer: definitions.fetch.FetchTopLevelElementDefinition['elemID'] = {
  custom:
    args =>
    ({ entry, defaultName }) => {
      // Each Okta tenant has exactly one default access policy configured marked with "system = true"
      // The default policy can be renamed, but it has a specific function and can only be partially modified,
      // therefore, we should verify default policies across envs will have the same elemID.
      if (entry?.system === true) {
        return naclCase('Default Policy')
      }
      const elemIDFunc = fetchUtils.element.createElemIDFunc<never>(args)
      return elemIDFunc({ entry, defaultName })
    },
}

const accessPolicyRuleCustomizer: definitions.fetch.FetchTopLevelElementDefinition['elemID'] = {
  custom:
    args =>
    ({ entry, defaultName, parent }) => {
      if (parent?.value?.system === true) {
        return naclCase(`Default Policy__${entry.name}`)
      }
      const elemIDFunc = fetchUtils.element.createElemIDFunc<never>(args)
      return elemIDFunc({ entry, defaultName, parent })
    },
  extendsParent: true,
}

const getPolicyCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<OktaFetchOptions>> => {
  const policiesToOmitPriorities = [ACCESS_POLICY_TYPE_NAME, PROFILE_ENROLLMENT_POLICY_TYPE_NAME, IDP_POLICY_TYPE_NAME]
  const policyRulesToOmitPriorities = [PROFILE_ENROLLMENT_RULE_TYPE_NAME]
  const rulesWithFieldsCustomizations = [MFA_RULE_TYPE_NAME, IDP_RULE_TYPE_NAME]
  const defs = Object.entries(POLICY_TYPE_NAME_TO_PARAMS).map(([typeName, details]) => ({
    [typeName]: {
      requests: [
        {
          endpoint: {
            path: '/api/v1/policies',
            queryArgs: {
              type: details.queryParam,
              ...(typeName === AUTOMATION_TYPE_NAME ? { activate: 'false' } : {}),
            },
          },
        },
      ],
      resource: {
        directFetch: true,
        recurseInto: {
          policyRules: {
            typeName: details.ruleName,
            context: {
              args: {
                policyId: {
                  root: 'id',
                },
              },
            },
          },
        },
      },
      element: {
        topLevel: {
          isTopLevel: true,
          serviceUrl: { path: details.policyServiceUrl },
          ...(typeName === ACCESS_POLICY_TYPE_NAME ? { elemID: accessPolicyCustomizer } : {}),
        },
        fieldCustomizations: {
          id: { hide: true },
          _links: { omit: true },
          ...(policiesToOmitPriorities.includes(typeName) ? { priority: { omit: true } } : {}),
          policyRules: {
            standalone: {
              typeName: details.ruleName,
              addParentAnnotation: true,
              referenceFromParent: false,
              nestPathUnderParent: true,
            },
          },
        },
      },
    },
    [details.ruleName]: {
      requests: [{ endpoint: { path: '/api/v1/policies/{policyId}/rules' } }],
      resource: { directFetch: false },
      element: {
        topLevel: {
          isTopLevel: true,
          ...(typeName === ACCESS_POLICY_TYPE_NAME
            ? { elemID: accessPolicyRuleCustomizer }
            : { elemID: { extendsParent: true } }),
          serviceUrl: { path: details.ruleServiceUrl ?? details.policyServiceUrl },
        },

        fieldCustomizations: {
          id: { hide: true },
          _links: { omit: true },
          ...(rulesWithFieldsCustomizations.includes(details.ruleName)
            ? { actions: { fieldType: 'PolicyRuleActions' }, conditions: { fieldType: 'PolicyRuleConditions' } }
            : {}),
          ...(policyRulesToOmitPriorities.includes(details.ruleName) ? { priority: { omit: true } } : {}),
        },
      },
    },
  }))
  return Object.assign({}, ...defs)
}

const createCustomizations = ({
  usePrivateAPI,
  includeProfileMappingProperties,
}: {
  usePrivateAPI: boolean
  includeProfileMappingProperties: boolean
}): Record<string, definitions.fetch.InstanceFetchApiDefinitions<OktaFetchOptions>> => ({
  // top-level types
  Group: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/groups',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/group/{id}' },
        elemID: { parts: [{ fieldName: 'profile.name' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        source: { fieldType: 'Group__source' },
        _links: { omit: true },
        lastMembershipUpdated: { omit: true },
      },
    },
  },
  GroupRule: {
    requests: [{ endpoint: { path: '/api/v1/groups/rules' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/groups#rules' },
      },
      fieldCustomizations: {
        id: { hide: true },
        allGroupsValid: { fieldType: 'boolean' },
      },
    },
  },
  ...getPolicyCustomizations(),
  Application: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/apps',
        },
        transformation: {
          adjust: ({ value }) => ({ value: assignPolicyIdsToApplication(value) }),
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        ApplicationGroupAssignment: {
          typeName: 'ApplicationGroupAssignment',
          context: {
            args: {
              appId: {
                root: 'id',
              },
            },
          },
        },
        AppUserSchema: {
          typeName: 'AppUserSchema',
          context: {
            args: {
              appId: {
                root: 'id',
              },
            },
          },
        },
        ...(usePrivateAPI
          ? {
              GroupPush: {
                typeName: 'GroupPush',
                context: {
                  args: {
                    appId: {
                      root: 'id',
                    },
                  },
                },
                conditions: [
                  {
                    // Only apps with GROUP_PUSH feature should have GroupPush
                    match: ['GROUP_PUSH'],
                    fromField: 'features',
                  },
                ],
              },
              GroupPushRule: {
                typeName: 'GroupPushRule',
                context: {
                  args: {
                    appId: {
                      root: 'id',
                    },
                  },
                },
                conditions: [
                  {
                    // Only apps with GROUP_PUSH feature should have GroupPushRule
                    match: ['GROUP_PUSH'],
                    fromField: 'features',
                  },
                ],
              },
            }
          : {}),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/app/{name}/instance/{id}/#tab-general' },
        elemID: { parts: [{ fieldName: 'label' }] },
      },
      fieldCustomizations: {
        name: { fieldType: 'string' },
        id: { hide: true },
        [CUSTOM_NAME_FIELD]: { fieldType: 'string', hide: true },
        _links: { hide: true },
        _embedded: { omit: true },
        credentials: { fieldType: 'ApplicationCredentials' },
        settings: { fieldType: 'unknown' },
        profileEnrollment: { fieldType: 'string' },
        accessPolicy: { fieldType: 'string' },
        ApplicationGroupAssignment: {
          standalone: {
            typeName: 'ApplicationGroupAssignment',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        AppUserSchema: {
          standalone: {
            typeName: 'AppUserSchema',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        GroupPush: {
          standalone: {
            typeName: 'GroupPush',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        GroupPushRule: {
          standalone: {
            typeName: 'GroupPushRule',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  ApplicationGroupAssignment: {
    requests: [
      {
        endpoint: { path: '/api/v1/apps/{appId}/groups' },
        transformation: {
          adjust: ({ value, context }) => ({
            value: {
              ...(_.isObject(value)
                ? {
                    ...value,
                    // assign app id from context to value to be used as service id
                    appId: context.appId,
                    // duplicate id to additonal field to be used as service id, because currently references can't be used as service id
                    groupId: _.get(value, 'id'),
                  }
                : {}),
            },
          }),
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: ['groupId', 'appId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id', isReference: true }], extendsParent: true },
        serviceUrl: { path: '/admin/app/{_parent.0.name}/instance/{_parent.0.id}/#tab-assignments' },
      },
      fieldCustomizations: {
        groupId: { fieldType: 'string', hide: true },
        appId: { fieldType: 'string', hide: true },
        _links: { omit: true },
        profile: { fieldType: 'map<unknown>' },
      },
    },
  },
  AppUserSchema: {
    requests: [{ endpoint: { path: '/api/v1/meta/schemas/apps/{appId}/default' } }],
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [], extendsParent: true },
        serviceUrl: { path: '/admin/universaldirectory#app/{_parent.0.id}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        name: { hide: true },
        type: { omit: true },
        properties: { omit: true },
        [naclCase('$schema')]: { omit: true },
      },
    },
  },
  ...(usePrivateAPI
    ? {
        GroupPush: {
          requests: [
            {
              endpoint: {
                path: '/api/internal/instance/{appId}/grouppush',
                client: 'private',
              },
              transformation: {
                root: 'mappings',
                adjust: ({ value }) => ({
                  value: {
                    ...(isGroupPushEntry(value)
                      ? {
                          mappingId: value.mappingId,
                          status: value.status,
                          userGroupId: value.sourceUserGroupId,
                          newAppGroupName: value.targetGroupName,
                          groupPushRule: value.ruleId,
                        }
                      : {}),
                  },
                }),
              },
            },
          ],
          resource: {
            directFetch: false,
            serviceIDFields: ['mappingId'],
          },
          element: {
            topLevel: {
              isTopLevel: true,
              elemID: { parts: [{ fieldName: 'userGroupId', isReference: true }], extendsParent: true },
              serviceUrl: { path: '/admin/app/{_parent.0.name}/instance/{_parent.0.id}/#tab-group-push' },
            },
            fieldCustomizations: { mappingId: { hide: true } },
          },
        },
        GroupPushRule: {
          requests: [
            {
              endpoint: {
                path: '/api/internal/instance/{appId}/grouppushrules',
                client: 'private',
              },
              // transformation: { root: 'mappings' },
            },
          ],
          resource: {
            directFetch: false,
            serviceIDFields: ['mappingRuleId'],
          },
          element: {
            topLevel: {
              isTopLevel: true,
              elemID: { extendsParent: true },
              serviceUrl: { path: '/admin/app/{_parent.0.name}/instance/{_parent.0.id}/#tab-group-push' },
            },
            fieldCustomizations: { mappingRuleId: { hide: true } },
          },
        },
      }
    : {}),
  ProfileMapping: {
    requests: [{ endpoint: { path: '/api/v1/mappings' } }],
    resource: {
      directFetch: true,
      recurseInto: {
        ...(includeProfileMappingProperties
          ? {
              properties: {
                typeName: 'ProfileMappingProperties',
                context: { args: { id: { root: 'id' } } },
                single: true,
              },
            }
          : {}),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: 'source.id', isReference: true },
            { fieldName: 'target.id', isReference: true },
          ],
        },
        valueGuard: isNotMappingToAuthenticatorApp,
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        properties: { fieldType: 'ProfileMappingProperties' },
      },
    },
  },
  ...(includeProfileMappingProperties
    ? {
        ProfileMappingProperties: {
          requests: [{ endpoint: { path: '/api/v1/mappings/{id}' }, transformation: { root: 'properties' } }],
        },
      }
    : {}),
  Brand: {
    requests: [{ endpoint: { path: '/api/v1/brands' } }],
    resource: {
      directFetch: true,
      recurseInto: {
        BrandTheme: {
          typeName: 'BrandTheme',
          context: { args: { brandId: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/customizations/footer' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        BrandTheme: {
          standalone: {
            typeName: 'BrandTheme',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  BrandTheme: {
    requests: [{ endpoint: { path: '/api/v1/brands/{brandId}/themes' } }],
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [], extendsParent: true },
        serviceUrl: { path: '/admin/customizations/branding' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { hide: true },
        logo: { hide: true },
        favicon: { hide: true },
      },
    },
  },
  UserType: {
    requests: [
      {
        endpoint: { path: '/api/v1/meta/types/user' },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        schema: {
          typeName: 'UserSchema',
          context: { args: { id: { adjust: extractSchemaIdFromUserType } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: 'admin/universaldirectory#okta/{id}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { hide: true },
        schemaId: { hide: true, fieldType: 'string' },
        schema: {
          standalone: {
            typeName: 'UserSchema',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },
  UserSchema: {
    requests: [
      {
        endpoint: { path: '/api/v1/meta/schemas/user/{id}' },
        transformation: {
          // assign user schema id from request context to value
          adjust: ({ value, context }) => ({ value: { ...(_.isObject(value) ? { ...value, id: context.id } : {}) } }),
        },
      },
    ],
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/universaldirectory#okta/{_parent.0.id}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        name: { hide: true },
        [naclCase('$schema')]: { omit: true },
        _links: { omit: true },
        type: { omit: true },
        title: { omit: true },
        description: { omit: true },
        properties: { omit: true },
      },
    },
  },
  GroupSchema: {
    requests: [{ endpoint: { path: '/api/v1/meta/schemas/group/default' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'title' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        [naclCase('$schema')]: { omit: true },
      },
    },
  },
  Role: {
    requests: [{ endpoint: { path: '/api/v1/iam/roles' }, transformation: { root: 'roles' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'label' }] },
      },
      fieldCustomizations: { id: { hide: true }, _links: { omit: true } },
    },
  },
  ResourceSet: {
    requests: [{ endpoint: { path: '/api/v1/iam/resource-sets' }, transformation: { root: 'resource-sets' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'label' }] },
      },
      fieldCustomizations: { id: { hide: true }, _links: { omit: true } },
    },
  },
  NetworkZone: {
    requests: [{ endpoint: { path: '/api/v1/zones' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/access/networks' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  BehaviorRule: {
    requests: [{ endpoint: { path: '/api/v1/behaviors' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/access/behaviors' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  Authenticator: {
    requests: [{ endpoint: { path: '/api/v1/authenticators' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/access/multifactor#policies' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  EventHook: {
    requests: [{ endpoint: { path: '/api/v1/eventHooks' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/workflow/eventhooks' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  InlineHook: {
    requests: [{ endpoint: { path: '/api/v1/inlineHooks' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/workflow/inlinehooks#view/{id}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  SmsTemplate: {
    requests: [{ endpoint: { path: '/api/v1/templates/sms' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/settings/sms' },
      },
      fieldCustomizations: {
        id: { hide: true },
        created: { omit: true },
        lastUpdated: { omit: true },
      },
    },
  },
  TrustedOrigin: {
    requests: [{ endpoint: { path: '/api/v1/trustedOrigins' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/access/api/trusted_origins' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  DeviceAssurance: {
    requests: [{ endpoint: { path: '/api/v1/device-assurances' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        lastUpdate: { omit: true },
        createdDate: { omit: true },
      },
    },
  },
  Domain: {
    requests: [{ endpoint: { path: '/api/v1/domains' }, transformation: { root: 'domains' } }],
    resource: { directFetch: true },
    element: {
      topLevel: { isTopLevel: true, elemID: { parts: [{ fieldName: 'domain' }], extendsParent: true } },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  EmailDomain: {
    requests: [{ endpoint: { path: '/api/v1/email-domains' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/email/domains' },
        elemID: { parts: [{ fieldName: 'displayName' }] },
      },
      fieldCustomizations: { id: { hide: true } },
    },
  },
  IdentityProvider: {
    requests: [{ endpoint: { path: '/api/v1/idps' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/access/identity-providers/edit/{id}' },
        elemID: { parts: [{ fieldName: 'name' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  AuthorizationServer: {
    requests: [{ endpoint: { path: '/api/v1/authorizationServers' } }],
    resource: {
      directFetch: true,
      recurseInto: {
        policies: {
          typeName: 'AuthorizationServerPolicy',
          context: { args: { id: { root: 'id' } } },
        },
        scopes: {
          typeName: 'OAuth2Scope',
          context: { args: { id: { root: 'id' } } },
        },
        claims: {
          typeName: 'OAuth2Claim',
          context: { args: { id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/oauth2/as/{id}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        issuer: { hide: true },
        _links: { omit: true },
        policies: {
          standalone: {
            typeName: 'AuthorizationServerPolicy',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
        scopes: {
          standalone: {
            typeName: 'OAuth2Scope',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
        claims: {
          standalone: {
            typeName: 'OAuth2Claim',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  AuthorizationServerPolicy: {
    requests: [
      {
        endpoint: { path: '/api/v1/authorizationServers/{id}/policies' },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        policyRules: {
          typeName: 'AuthorizationServerPolicyRule',
          context: { args: { policyId: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: { isTopLevel: true, elemID: { extendsParent: true } },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        policyRules: {
          standalone: {
            typeName: 'AuthorizationServerPolicyRule',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  AuthorizationServerPolicyRule: {
    requests: [{ endpoint: { path: '/api/v1/authorizationServers/{id}/policies/{policyId}/rules' } }],
    resource: { directFetch: false },
    element: {
      topLevel: { isTopLevel: true, elemID: { extendsParent: true } },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  OAuth2Scope: {
    requests: [{ endpoint: { path: '/api/v1/authorizationServers/{id}/scopes' } }],
    resource: { directFetch: false },
    element: {
      topLevel: { isTopLevel: true, elemID: { extendsParent: true } },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  OAuth2Claim: {
    requests: [{ endpoint: { path: '/api/v1/authorizationServers/{id}/claims' } }],
    resource: { directFetch: false },
    element: {
      topLevel: { isTopLevel: true, elemID: { extendsParent: true } },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  Feature: {
    requests: [{ endpoint: { path: '/api/v1/features' } }],
    resource: { directFetch: true },
    element: {
      topLevel: { isTopLevel: true },
      fieldCustomizations: { id: { hide: true }, _links: { omit: true } },
    },
  },
  User: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/users',
          headers: OMIT_CREDS_HEADER,
        },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'profile.login' }] },
        serviceUrl: { path: '/admin/user/profile/view/{id}#tab-account' },
      },
      fieldCustomizations: {
        id: { hide: true },
        statusChanged: { omit: true },
        lastLogin: { omit: true },
        passwordChanged: { omit: true },
        activated: { omit: true },
        _links: { omit: true },
        type: { fieldType: 'UserTypeRef' },
      },
    },
  },
  UserTypeRef: {
    element: {
      fieldCustomizations: {
        id: { hide: false },
      },
    },
  },
  // singleton types
  OrgSetting: {
    requests: [{ endpoint: { path: '/api/v1/org' }, transformation: { root: '.' } }],
    resource: {
      directFetch: true,
      recurseInto: {
        contactTypes: {
          typeName: 'ContactType',
          context: { args: {} },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
        serviceUrl: { path: '/admin/settings/account' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        contactTypes: { fieldType: 'ContactType' },
      },
    },
  },
  ContactType: {
    requests: [{ endpoint: { path: '/api/v1/org/contacts' }, transformation: { root: '.' } }],
    resource: { directFetch: false, serviceIDFields: ['contactType'] },
    element: {
      fieldCustomizations: {
        _links: { omit: true },
      },
    },
  },
  PerClientRateLimitSettings: {
    requests: [{ endpoint: { path: '/api/v1/rate-limit-settings/per-client' } }],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
        serviceUrl: { path: '/admin/settings/account' },
      },
    },
  },
  RateLimitAdminNotifications: {
    requests: [{ endpoint: { path: '/api/v1/rate-limit-settings/admin-notifications' } }],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
        serviceUrl: { path: '/admin/settings/account' },
      },
    },
  },
  ...getPrivateAPISettingsDefinitions({ usePrivateAPI }),
  // inner types
  ApplicationCredentials: {
    element: {
      fieldCustomizations: {
        signing: { omit: true },
      },
    },
  },
  ApplicationVisibility: {
    element: {
      fieldCustomizations: {
        // The field cannot be changed and might include non multienv values
        appLinks: { omit: true },
      },
    },
  },
  ProfileMappingSource: {
    element: {
      fieldCustomizations: {
        _links: { omit: true },
      },
    },
  },
  ProfileMappingTarget: {
    element: {
      fieldCustomizations: {
        _links: { omit: true },
      },
    },
  },
  Protocol: {
    element: {
      fieldCustomizations: { credentials: { omit: true } },
    },
  },
  AuthenticatorProviderConfiguration: {
    element: {
      fieldCustomizations: {
        secretKey: { omit: true },
        sharedSecret: { omit: true },
      },
    },
  },
  ProfileEnrollmentPolicyRuleAction: {
    element: {
      fieldCustomizations: {
        // TODO: should change to reference in SALTO-3806
        uiSchemaId: { hide: true, fieldType: 'string' },
      },
    },
  },
  DevicePolicyRuleCondition: {
    element: {
      fieldCustomizations: {
        registered: { fieldType: 'boolean' },
        managed: { fieldType: 'boolean' },
        assurance: { fieldType: 'DeviceCondition' },
      },
    },
  },
  AuthorizationServerCredentialsSigningConfig: {
    element: {
      fieldCustomizations: {
        kid: { hide: true },
        lastRotated: { hide: true },
        nextRotation: { hide: true },
      },
    },
  },
  ProfileEnrollmentPolicyRuleProfileAttribute: {
    element: {
      fieldCustomizations: {
        name: { fieldType: 'UserSchemaAttribute' },
      },
    },
  },
})

export const CLASSIC_ENGINE_UNSUPPORTED_TYPES = [
  DEVICE_ASSURANCE,
  AUTHENTICATOR_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
]

const getInsufficientPermissionsError: definitions.fetch.FetchResourceDefinition['onError'] = {
  custom:
    () =>
    ({ error, typeName }) => {
      if (error instanceof clientUtils.HTTPError && error.response.status === 403) {
        return {
          action: 'customSaltoError',
          value: {
            message: `Salto could not access the ${typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`,
            severity: 'Info',
          },
        }
      }
      return { action: 'failEntireFetch', value: false }
    },
  // TODO SALTO-6004 remove
  // this is a workaround to overcome types checker, the "custom" function is applied any other values are ignored
  action: 'failEntireFetch',
  value: false,
}

export const createFetchDefinitions = (
  userConfig: OktaUserConfig,
  usePrivateAPI: boolean,
  baseUrl?: string,
): definitions.fetch.FetchApiDefinitions<OktaFetchOptions> => {
  const {
    fetch: { includeProfileMappingProperties },
  } = userConfig
  return {
    instances: {
      default: {
        resource: {
          serviceIDFields: ['id'],
          onError: getInsufficientPermissionsError,
        },
        element: {
          topLevel: {
            elemID: { parts: DEFAULT_ID_PARTS, useOldFormat: true },
            serviceUrl: { baseUrl },
          },
          fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
        },
      },
      customizations: createCustomizations({
        usePrivateAPI,
        includeProfileMappingProperties: includeProfileMappingProperties === true,
      }),
    },
  }
}
