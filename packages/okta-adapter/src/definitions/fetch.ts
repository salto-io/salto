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
import { definitions } from '@salto-io/adapter-components'
import { OktaConfig, POLICY_TYPE_NAME_TO_PARAMS } from '../config'
import { ClientOptions, PaginationOptions } from './types'
import {
  ACCESS_POLICY_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  CUSTOM_NAME_FIELD,
} from '../constants'

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
  endpoint: string
  serviceUrl: string
}): definitions.fetch.InstanceFetchApiDefinitions<{
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
}> => ({
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
}): Record<string, definitions.fetch.InstanceFetchApiDefinitions<{ clientOptions: ClientOptions, paginationOptions: PaginationOptions }>> => {
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

const getPolicyCustomizations = (): Record<
  string,
  definitions.fetch.InstanceFetchApiDefinitions<{ clientOptions: ClientOptions }>
> => {
  const policiesToOmitPriorities = [ACCESS_POLICY_TYPE_NAME, PROFILE_ENROLLMENT_POLICY_TYPE_NAME, IDP_POLICY_TYPE_NAME]
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
                  fromField: 'id',
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
          elemID: { extendsParent: true },
          serviceUrl: { path: details.ruleServiceUrl ?? details.policyServiceUrl },
        },
        fieldCustomizations: {
          id: { hide: true },
          _links: { omit: true },
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
}): Record<
  string,
  definitions.fetch.InstanceFetchApiDefinitions<{ clientOptions: ClientOptions; paginationOptions: PaginationOptions }>
> => ({
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
                fromField: 'id',
              },
            },
          },
        },
        AppUserSchema: {
          typeName: 'AppUserSchema',
          context: {
            args: {
              appId: {
                fromField: 'id',
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
                      fromField: 'id',
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
                      fromField: 'id',
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
        credentials: { fieldType: 'ApplicationCredentials' }, // TODOS not working
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
    requests: [{ endpoint: { path: 'api/v1/apps/{appId}/groups' } }],
    // TODOS define serviceIDFields
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id', isReference: true }], extendsParent: true },
        serviceUrl: { path: '/admin/app/{_parent.0.name}/instance/{_parent.0.id}/#tab-assignments' },
      },
      fieldCustomizations: {
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
        name: { hide: true },
        type: { omit: true },
        properties: { omit: true },
        $schema: { omit: true },
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
                // TODOS should adjust
                // adjust: ({ value }) => ({
                //   value: { ...value, userGroupOd: value?.sourceUserGroupId },
                // }),
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
              // TODOS modify to userGroupId after adjusting value
              elemID: { parts: [{ fieldName: 'sourceUserGroupId', isReference: true }], extendsParent: true },
              serviceUrl: { path: '/admin/app/{_parent.0.name}/instance/{_parent.0.id}/#tab-group-push' },
            },
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
                context: { args: { id: { fromField: 'id' } } },
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
        themes: {
          typeName: 'BrandTheme',
          context: { args: { brandId: { fromField: 'id' } } },
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
        themes: {
          standalone: {
            typeName: 'BrandTheme',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: false,
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
    requests: [{ endpoint: { path: '/api/v1/meta/types/user' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: 'admin/universaldirectory#okta/{id}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { hide: true },
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
    requests: [{ endpoint: { path: 'api/v1/templates/sms' } }],
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
      topLevel: { isTopLevel: true, elemID: { parts: [{ fieldName: 'domain' }] } },
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
          context: { args: { id: { fromField: 'id' } } },
        },
        scopes: {
          typeName: 'OAuth2Scope',
          context: { args: { id: { fromField: 'id' } } },
        },
        claims: {
          typeName: 'OAuth2Claim',
          context: { args: { id: { fromField: 'id' } } },
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
    requests: [{ 
      endpoint: { path: '/api/v1/authorizationServers/{id}/policies' },
    }],
    resource: {
      directFetch: false,
      recurseInto: {
        policyRules: {
          typeName: 'AuthorizationServerPolicyRule',
          context: { args: { policyId: { fromField: 'id' } } },
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
      },
    },
  },
  ContactType: {
    // TODOS something here is off
    requests: [{ endpoint: { path: '/api/v1/org/contacts' }, transformation: { root: '.' } }],
    resource: { directFetch: false },
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
  ProfileEnrollmentPolicyRule__actions__profileEnrollment: {
    element: {
      fieldCustomizations: {
        // TODO: should change to reference in SALTO-3806
        uiSchemaId: { hide: true, fieldType: 'string' },
      },
    },
  },
})

export const createFetchDefinitions = (
  config: OktaConfig,
): definitions.fetch.FetchApiDefinitions<{
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
}> => {
  const {
    client,
    fetch: { includeProfileMappingProperties },
  } = config
  const usePrivateAPI = client?.usePrivateAPI ?? true
  return {
    instances: {
      default: {
        resource: {
          serviceIDFields: ['id'],
        },
        element: {
          topLevel: {
            elemID: { parts: DEFAULT_ID_PARTS },
          },
          fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
        },
      },
      customizations: createCustomizations({
        usePrivateAPI,
        includeProfileMappingProperties: includeProfileMappingProperties ?? true,
      }),
    },
  }
}
