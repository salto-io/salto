/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { ERROR_MESSAGES, naclCase, validatePlainObject } from '@salto-io/adapter-utils'
import {
  definitions,
  fetch as fetchUtils,
  elements as elementUtils,
  client as clientUtils,
} from '@salto-io/adapter-components'
import { POLICY_TYPE_NAME_TO_PARAMS } from '../../config'
import { OktaOptions } from '../types'
import { OktaUserConfig } from '../../user_config'
import {
  ACCESS_POLICY_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  CUSTOM_NAME_FIELD,
  MFA_RULE_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  DEVICE_ASSURANCE_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
  GROUP_MEMBERSHIP_TYPE_NAME,
  JWK_TYPE_NAME,
  EMBEDDED_SIGN_IN_SUPPORT_TYPE_NAME,
  EMAIL_CUSTOMIZATION_TYPE_NAME,
  EMAIL_TEMPLATE_TYPE_NAME,
  AUTOMATION_RULE_TYPE_NAME,
  SIGN_IN_PAGE_TYPE_NAME,
  ERROR_PAGE_TYPE_NAME,
  INBOUND_PROVISIONING_SUPPORTED_APP_NAMES,
  USER_PROVISIONING_SUPPORTED_APP_NAMES,
  USER_ROLES_TYPE_NAME,
} from '../../constants'
import { isGroupPushEntry } from '../../filters/group_push'
import { extractSchemaIdFromUserType } from './types/user_type'
import { isNotMappingToAuthenticatorApp } from './types/profile_mapping'
import { assignPolicyIdsToApplication, generateExcludeRegex, isOktaDashboard } from './types/application'
import { shouldConvertUserIds } from '../../user_utils'
import { isNotDeletedEmailDomain } from './types/email_domain'
import { isDefaultDomain } from './types/domain'
import { isDefaultBrand } from './types/brand'
import { isDefaultAccessPolicy } from './types/access_policy'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created: { omit: true },
  lastUpdated: { omit: true },
  createdBy: { omit: true },
  lastUpdatedBy: { omit: true },
}

const getPrivateAPICustomizations = ({
  endpoint,
  serviceUrl,
}: {
  endpoint: definitions.EndpointPath
  serviceUrl: string
}): definitions.fetch.InstanceFetchApiDefinitions<OktaOptions> => ({
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
}): Record<string, definitions.fetch.InstanceFetchApiDefinitions<OktaOptions>> => {
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

const getPolicyCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<OktaOptions>> => {
  const policiesToOmitPriorities = [
    ACCESS_POLICY_TYPE_NAME,
    PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
    IDP_POLICY_TYPE_NAME,
    AUTOMATION_TYPE_NAME,
  ]
  const policyRulesToOmitPriorities = [PROFILE_ENROLLMENT_RULE_TYPE_NAME, AUTOMATION_RULE_TYPE_NAME]
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
          ...(typeName === ACCESS_POLICY_TYPE_NAME
            ? {
                elemID: {
                  parts: [
                    { fieldName: 'name', condition: (value: Values) => !isDefaultAccessPolicy(value) },
                    { fieldName: '', condition: isDefaultAccessPolicy, custom: () => () => 'Default Policy' },
                  ],
                },
              }
            : {}),
        },
        fieldCustomizations: {
          id: { hide: true },
          _links: { omit: true },
          priority: policiesToOmitPriorities.includes(typeName) ? { omit: true } : { hide: true },
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
          allowEmptyArrays: typeName === PROFILE_ENROLLMENT_RULE_TYPE_NAME ? true : undefined,
        },

        fieldCustomizations: {
          id: { hide: true },
          _links: { omit: true },
          ...(rulesWithFieldsCustomizations.includes(details.ruleName)
            ? { actions: { fieldType: 'PolicyRuleActions' }, conditions: { fieldType: 'PolicyRuleConditions' } }
            : {}),
          priority: policyRulesToOmitPriorities.includes(details.ruleName) ? { omit: true } : { hide: true },
        },
      },
    },
  }))
  return Object.assign({}, ...defs)
}

const createCustomizations = ({
  usePrivateAPI,
  includeProfileMappingProperties,
  includeGroupMemberships,
  userIdentifier,
}: {
  usePrivateAPI: boolean
  includeProfileMappingProperties: boolean
  includeGroupMemberships: boolean
  userIdentifier: 'id' | 'email'
}): Record<string, definitions.fetch.InstanceFetchApiDefinitions<OktaOptions>> => ({
  // top-level types
  Group: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/groups',
          queryArgs: includeGroupMemberships ? { expand: 'stats' } : {},
        },
        transformation: {
          adjust: async ({ value }) => ({
            value: {
              ...(_.isObject(value) ? { ..._.omit(value, '_embedded') } : {}),
              recurseIntoGroupMembers: _.get(value, ['_embedded', 'stats', 'usersCount']) === 0 ? 'false' : 'true',
            },
          }),
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        ...(includeGroupMemberships
          ? {
              [GROUP_MEMBERSHIP_TYPE_NAME]: {
                typeName: GROUP_MEMBERSHIP_TYPE_NAME,
                context: {
                  args: {
                    groupId: {
                      root: 'id',
                    },
                  },
                },
                conditions: [
                  {
                    // only recurse into groups with assigned users
                    match: ['true'],
                    fromField: 'recurseIntoGroupMembers',
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
        serviceUrl: { path: '/admin/group/{id}' },
        elemID: { parts: [{ fieldName: 'profile.name' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        source: { fieldType: 'Group__source' },
        _links: { omit: true },
        lastMembershipUpdated: { omit: true },
        recurseIntoGroupMembers: { omit: true },
        [GROUP_MEMBERSHIP_TYPE_NAME]: {
          standalone: {
            typeName: GROUP_MEMBERSHIP_TYPE_NAME,
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
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
  [GROUP_MEMBERSHIP_TYPE_NAME]: {
    requests: [
      {
        endpoint: { path: '/api/v1/groups/{groupId}/users' },
        transformation: {
          // assign groupId which was set by the parent group to request context, to group membership's value so we can use mergeAndTransform
          adjust: async ({ value, context }) => ({
            value: { ...(_.isObject(value) ? { ...value, groupId: context.groupId } : {}) },
          }),
        },
      },
    ],
    resource: {
      directFetch: false,
      // merge all users assigned to the same group into a single instance based on 'groupId'
      serviceIDFields: ['groupId'],
      mergeAndTransform: {
        adjust: async ({ context }) => ({
          value: {
            members: context.fragments.map(fragment =>
              _.get(fragment.value, userIdentifier === 'id' ? 'id' : 'profile.login'),
            ),
          },
        }),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [], extendsParent: true, useOldFormat: false },
      },
    },
  },
  ...getPolicyCustomizations(),
  [USER_ROLES_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/iam/assignees/users',
        },
        transformation: {
          root: 'value',
          adjust: async ({ value }) => {
            validatePlainObject(value, 'User Roles response')
            return {
              value: {
                ...value,
                // duplicate id to additional field to extract reference, because currently references can't be used as service ids
                user: _.get(value, 'id'),
              },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['id'],
      recurseInto: {
        roles: {
          typeName: 'UserRole',
          context: {
            args: {
              id: {
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
        elemID: { parts: [{ fieldName: 'user', isReference: true }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        orn: { omit: true },
        _links: { omit: true },
      },
    },
  },
  UserRole: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/users/{id}/roles',
          method: 'get',
        },
      },
    ],
    resource: { directFetch: false },
    element: {
      fieldCustomizations: {
        id: { omit: true },
        _links: { omit: true },
        status: { omit: true },
        assignmentType: { omit: true },
      },
    },
  },
  Application: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/apps',
        },
        transformation: {
          adjust: async ({ value }) => ({ value: assignPolicyIdsToApplication(value) }),
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
        apiScopes: {
          typeName: 'OAuth2ScopeConsentGrant',
          conditions: [
            {
              fromField: 'signOnMode',
              match: ['^OPENID_CONNECT$'],
            },
          ],
          context: {
            args: {
              appId: {
                root: 'id',
              },
            },
          },
        },
        applicationUserProvisioning: {
          typeName: 'ApplicationUserProvisioning',
          conditions: [
            {
              fromField: 'name',
              match: USER_PROVISIONING_SUPPORTED_APP_NAMES.map(name => `^${name}$`),
            },
            // Provisioning is only available for apps with features, but it's possible for an app to have features without provisioning.
            { fromField: 'features', match: ['.+'] },
          ],
          context: {
            args: {
              appId: {
                root: 'id',
              },
            },
          },
          single: true,
        },
        applicationInboundProvisioning: {
          typeName: 'ApplicationInboundProvisioning',
          conditions: [
            {
              fromField: 'name',
              match: INBOUND_PROVISIONING_SUPPORTED_APP_NAMES.map(name => `^${name}$`),
            },
            // Provisioning is only available for apps with features, but it's possible for an app to have features without provisioning.
            { fromField: 'features', match: ['.+'] },
          ],
          context: {
            args: {
              appId: {
                root: 'id',
              },
            },
          },
          single: true,
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
                  {
                    // Okta returns 404 for '/api/internal/instance/{appId}/grouppushrules' if the app is in status inactive
                    match: ['^ACTIVE$'],
                    fromField: 'status',
                  },
                ],
              },
              applicationProvisioningGeneral: {
                typeName: 'ApplicationProvisioningGeneral',
                conditions: [
                  {
                    fromField: 'name',
                    match: generateExcludeRegex(INBOUND_PROVISIONING_SUPPORTED_APP_NAMES),
                  },
                  // Provisioning is only available for apps with features, but it's possible for an app to have features without provisioning.
                  { fromField: 'features', match: ['.+'] },
                ],
                context: {
                  args: {
                    appId: {
                      root: 'id',
                    },
                  },
                },
                single: true,
              },
              applicationProvisioningUsers: {
                typeName: 'ApplicationProvisioningUsers',
                conditions: [
                  {
                    fromField: 'name',
                    match: generateExcludeRegex(INBOUND_PROVISIONING_SUPPORTED_APP_NAMES),
                  },
                  // Provisioning is only available for apps with features, but it's possible for an app to have features without provisioning.
                  { fromField: 'features', match: ['.+'] },
                ],
                context: {
                  args: {
                    appId: {
                      root: 'id',
                    },
                  },
                },
              },
            }
          : {}),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/app/{name}/instance/{id}/#tab-general' },
        elemID: {
          parts: [
            { fieldName: 'label', condition: value => !isOktaDashboard(value) },
            // "Okta Dashboard" is a special app that can only have one instance. We need to ensure its element ID is
            // identical across all environments, so we hardcode it and not depend on its label, which can change.
            // TODO(SALTO-7005): Remove fieldName from this definition.
            { fieldName: '', condition: isOktaDashboard, custom: () => () => 'Okta Dashboard' },
          ],
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        name: { fieldType: 'string' },
        id: { hide: true },
        orn: { omit: true },
        [CUSTOM_NAME_FIELD]: { fieldType: 'string', hide: true },
        _links: { hide: true },
        _embedded: { omit: true },
        credentials: { fieldType: 'ApplicationCredentials' },
        applicationProvisioningUsers: { fieldType: 'unknown' },
        applicationProvisioningGeneral: { fieldType: 'unknown' },
        applicationInboundProvisioning: { fieldType: 'ApplicationFeature' },
        applicationUserProvisioning: { fieldType: 'ApplicationFeature' },
        apiScopes: { fieldType: 'list<OAuth2ScopeConsentGrant>' },
        settings: { fieldType: 'unknown' },
        profileEnrollment: { fieldType: 'string' },
        accessPolicy: { fieldType: 'string' },
        features: { sort: { properties: [] } },
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
          adjust: async ({ value, context }) => ({
            value: {
              ...(_.isObject(value)
                ? {
                    ...value,
                    // assign app id from context to value to be used as service id
                    appId: context.appId,
                    // duplicate id to additional field to be used as service id, because currently references can't be used as service id
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
  OAuth2ScopeConsentGrant: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/apps/{appId}/grants',
        },
        transformation: {
          omit: ['_links', 'createdBy', 'status', 'created', 'lastUpdated', 'clientId', 'source', 'issuer'],
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      fieldCustomizations: {
        id: { omit: true },
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
                adjust: async ({ value }) => ({
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
        ApplicationUserProvisioning: {
          requests: [
            {
              endpoint: {
                path: '/api/v1/apps/{appId}/features/USER_PROVISIONING',
              },
              transformation: {
                omit: ['_links', 'name', 'description', 'status'],
              },
            },
          ],
          resource: {
            directFetch: false,
          },
        },
        ApplicationInboundProvisioning: {
          requests: [
            {
              endpoint: {
                path: '/api/v1/apps/{appId}/features/INBOUND_PROVISIONING',
              },
              transformation: {
                omit: ['_links', 'name', 'description', 'status'],
              },
            },
          ],
          resource: {
            directFetch: false,
          },
        },
        ApplicationProvisioningGeneral: {
          requests: [
            {
              endpoint: {
                path: '/api/v1/internal/apps/instance/{appId}/settings/user-mgmt-general',
                client: 'private',
              },
              transformation: {
                pick: ['enabled', 'importSettings.userNameTemplate', 'importSettings.importInterval'],
              },
            },
          ],
          resource: {
            directFetch: false,
          },
        },
        ApplicationProvisioningUsers: {
          requests: [
            {
              endpoint: {
                path: '/api/v1/internal/apps/{appId}/settings/importMatchRules',
                client: 'private',
              },
              transformation: {
                omit: ['id'],
              },
            },
          ],
          resource: {
            directFetch: false,
            serviceIDFields: [], // The default serviceId is 'id' which causes to returned values to be merged since we remove it.
          },
        },
      }
    : {}),
  ProfileMapping: {
    requests: [{ endpoint: { path: '/api/v1/mappings' } }],
    resource: {
      directFetch: true,
      onError: {
        custom:
          () =>
          ({ error, typeName }) => {
            // /api/v1/mappings returns 401 when the feature is not enabled in the account
            if (error instanceof clientUtils.HTTPError && error.response.status === 401) {
              return {
                action: 'configSuggestion',
                value: {
                  type: 'typeToExclude',
                  value: typeName,
                  reason: `Salto could not access the ${typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`,
                },
              }
            }
            return { action: 'failEntireFetch', value: false }
          },
        action: 'failEntireFetch',
        value: false,
      },
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
        EmailTemplate: {
          typeName: 'EmailTemplate',
          context: { args: { brandId: { root: 'id' } } },
        },
        SignInPage: {
          typeName: 'SignInPage',
          context: { args: { brandId: { root: 'id' } } },
        },
        ErrorPage: {
          typeName: 'ErrorPage',
          context: { args: { brandId: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/customizations/footer' },
        elemID: {
          parts: [
            { fieldName: 'name', condition: value => !isDefaultBrand(value) },
            // fieldName is required, but our custom function doesn't need it, so use an empty string for typing.
            // TODO(SALTO-7005): Remove fieldName from this definition.
            { fieldName: '', condition: isDefaultBrand, custom: () => () => 'Default Brand' },
          ],
        },
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
        EmailTemplate: {
          standalone: {
            typeName: 'EmailTemplate',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        SignInPage: {
          standalone: {
            typeName: 'SignInPage',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        ErrorPage: {
          standalone: {
            typeName: 'ErrorPage',
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
  [EMAIL_TEMPLATE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/brands/{brandId}/templates/email',
          queryArgs: { expand: 'settings' },
        },
        transformation: {
          rename: [{ from: '_embedded.settings', to: 'settings', onConflict: 'override' }],
          adjust: async ({ value, context }) => ({
            value: {
              ...(_.isObject(value)
                ? {
                    ...value,
                    // assign brand id from context to value to be used as service id
                    brandId: context.brandId,
                  }
                : {}),
            },
          }),
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: ['name', 'brandId'],
      recurseInto: {
        EmailCustomization: {
          typeName: 'EmailCustomization',
          context: { args: { templateName: { root: 'name' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'name' }], extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        serviceUrl: { path: '/admin/customizations/brands/{brandId}/emails/{name}' },
      },
      fieldCustomizations: {
        _links: { omit: true },
        settings: { fieldType: 'EmailSettings' },
        brandId: { hide: true },
        EmailCustomization: {
          standalone: {
            typeName: 'EmailCustomization',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  EmailSettings: {
    element: {
      fieldCustomizations: {
        _links: { omit: true },
      },
    },
  },
  [EMAIL_CUSTOMIZATION_TYPE_NAME]: {
    requests: [{ endpoint: { path: '/api/v1/brands/{brandId}/templates/email/{templateName}/customizations' } }],
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'language' }], extendsParent: true },
        serviceUrl: { path: '/admin/customizations/brands/{_parent.0.brandId}/emails/{_parent.0.name}' },
        importantValues: [
          { value: 'language', indexed: true, highlighted: true },
          { value: 'subject', indexed: false, highlighted: true },
        ],
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
      },
    },
  },
  [SIGN_IN_PAGE_TYPE_NAME]: {
    requests: [
      {
        endpoint: { path: '/api/v1/brands/{brandId}/pages/sign-in/customized' },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
        serviceUrl: { path: '/admin/customizations/brands/{_parent.0.brandId}/pages/sign-in' },
      },
    },
  },
  [ERROR_PAGE_TYPE_NAME]: {
    requests: [
      {
        endpoint: { path: '/api/v1/brands/{brandId}/pages/error/customized' },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
        serviceUrl: { path: '/admin/customizations/brands/{_parent.0.brandId}/pages/error' },
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
          adjust: async ({ value, context }) => ({
            value: { ...(_.isObject(value) ? { ...value, id: context.id } : {}) },
          }),
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
    resource: {
      directFetch: true,
      recurseInto: {
        permissions: {
          typeName: 'Permission',
          context: { args: { id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'label' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        _links: { omit: true },
        permissions: { fieldType: 'list<Permission>', sort: { properties: [{ path: 'label' }] } },
      },
    },
  },
  Permission: {
    requests: [
      {
        endpoint: { path: '/api/v1/iam/roles/{id}/permissions' },
        transformation: { root: 'permissions' },
      },
    ],
    resource: { directFetch: false, serviceIDFields: ['label'] },
    element: {
      fieldCustomizations: {
        created: { omit: true },
        lastUpdated: { omit: true },
        _links: { omit: true },
      },
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
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: 'domain', condition: value => !isDefaultDomain(value) },
            { fieldName: '', condition: isDefaultDomain, custom: () => () => 'Default Domain' },
          ],
          extendsParent: true,
        },
        alias: { aliasComponents: [{ fieldName: 'domain' }] },
      },
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
        valueGuard: isNotDeletedEmailDomain,
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
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        scopes: {
          standalone: {
            typeName: 'OAuth2Scope',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        claims: {
          standalone: {
            typeName: 'OAuth2Claim',
            addParentAnnotation: true,
            referenceFromParent: false,
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
        priority: { hide: true },
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
        priority: { hide: true },
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
    requests: [
      {
        endpoint: {
          path: '/api/v1/authorizationServers/{id}/claims',
          // only include claims that are shown in Okta's Admin Console
          queryArgs: { includeClaims: 'sub,custom' },
        },
      },
    ],
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
        importantValues: [{ value: 'claimType', indexed: true, highlighted: true }],
      },
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
        },
      },
    ],
    resource: {
      directFetch: true,
      onError: {
        custom:
          () =>
          ({ error }) => {
            if (error instanceof fetchUtils.errors.MaxResultsExceeded) {
              const message = `The number of users fetched exceeded the maximum allowed: ${error.maxResults}. Consider excluding this type or filtering users by a specific status.`
              return {
                action: 'customSaltoError',
                value: {
                  message: ERROR_MESSAGES.OTHER_ISSUES,
                  detailedMessage: message,
                  severity: 'Warning',
                },
              }
            }
            return undefined
          },
        action: 'failEntireFetch',
        value: false,
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'profile.login' }] },
        serviceUrl: { path: '/admin/user/profile/view/{id}#tab-account' },
        importantValues: [{ value: 'profile.login', indexed: false, highlighted: true }],
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
  UserCredentials: {
    element: {
      fieldCustomizations: {
        recovery_question: { omit: true },
        password: { omit: true },
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
  [JWK_TYPE_NAME]: {
    requests: [{ endpoint: { path: '/api/v1/idps/credentials/keys' } }],
    resource: { directFetch: true, serviceIDFields: ['kid'] },
    element: {
      topLevel: {
        isTopLevel: true,
        // hashed representation of the key
        elemID: { parts: [{ fieldName: naclCase('x5t#S256') }] },
      },
      fieldCustomizations: {
        kid: { hide: true },
        expiresAt: { omit: true },
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
  IdentityProviderCredentialsClient: {
    element: {
      fieldCustomizations: {
        client_secret: { omit: true },
      },
    },
  },
  IdentityProviderCredentialsSigning: {
    element: {
      fieldCustomizations: {
        kid: { omit: true },
      },
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
  AuthenticatorSettings: {
    element: {
      fieldCustomizations: {
        userVerificationMethods: {
          fieldType: 'list<string>',
          sort: { properties: [] },
        },
      },
    },
  },
})

export const CLASSIC_ENGINE_UNSUPPORTED_TYPES = [
  DEVICE_ASSURANCE_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  EMBEDDED_SIGN_IN_SUPPORT_TYPE_NAME,
]

export const createFetchDefinitions = ({
  userConfig,
  fetchQuery,
  usePrivateAPI,
  baseUrl,
}: {
  userConfig: OktaUserConfig
  fetchQuery: elementUtils.query.ElementQuery
  usePrivateAPI: boolean
  baseUrl?: string
}): definitions.fetch.FetchApiDefinitions<OktaOptions> => {
  const {
    fetch: { includeProfileMappingProperties, includeGroupMemberships },
  } = userConfig
  const userIdentifier = shouldConvertUserIds(fetchQuery, userConfig) ? 'email' : 'id'
  return {
    instances: {
      default: {
        resource: {
          serviceIDFields: ['id'],
          onError: fetchUtils.errors.createGetInsufficientPermissionsErrorFunction([403]),
        },
        element: {
          topLevel: {
            elemID: { parts: DEFAULT_ID_PARTS, useOldFormat: true },
            serviceUrl: { baseUrl },
            importantValues: [
              { value: 'status', indexed: true, highlighted: true },
              { value: 'type', indexed: true, highlighted: true },
              { value: 'name', indexed: false, highlighted: true },
            ],
          },
          fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
        },
      },
      customizations: createCustomizations({
        usePrivateAPI,
        includeProfileMappingProperties: includeProfileMappingProperties === true,
        includeGroupMemberships: includeGroupMemberships === true,
        userIdentifier,
      }),
    },
  }
}
