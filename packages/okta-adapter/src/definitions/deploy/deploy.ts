/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions, deployment } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import {
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isRemovalChange,
  Values,
} from '@salto-io/adapter-api'
import { getParents, naclCase, validatePlainObject } from '@salto-io/adapter-utils'
import { AdditionalAction, ClientOptions } from '../types'
import {
  APPLICATION_TYPE_NAME,
  BRAND_TYPE_NAME,
  CUSTOM_NAME_FIELD,
  DEVICE_ASSURANCE_TYPE_NAME,
  DOMAIN_TYPE_NAME,
  GROUP_TYPE_NAME,
  INACTIVE_STATUS,
  LINKS_FIELD,
  SMS_TEMPLATE_TYPE_NAME,
  USERTYPE_TYPE_NAME,
  NAME_FIELD,
  ID_FIELD,
  BRAND_THEME_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  AUTHORIZATION_POLICY,
  APP_LOGO_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  JWK_TYPE_NAME,
  EMAIL_DOMAIN_TYPE_NAME,
  EMAIL_TEMPLATE_TYPE_NAME,
  EMAIL_CUSTOMIZATION_TYPE_NAME,
  PROFILE_MAPPING_TYPE_NAME,
  SIGN_IN_PAGE_TYPE_NAME,
  ERROR_PAGE_TYPE_NAME,
  AUTHORIZATION_SERVER,
  GROUP_RULE_TYPE_NAME,
  ROLE_TYPE_NAME,
  APP_PROVISIONING_FIELD_NAMES,
  USER_ROLES_TYPE_NAME,
  API_SCOPES_FIELD_NAME,
} from '../../constants'
import {
  APP_POLICIES,
  createDeployAppPolicyRequests,
  getIssuerField,
  getOAuth2ScopeConsentGrantIdFromSharedContext,
  getSubdomainFromElementsSource,
  GRANTS_CHANGE_ID_FIELDS,
  isInactiveCustomAppChange,
} from './types/application'
import { isActivationChange, isDeactivationChange } from './utils/status'
import * as simpleStatus from './utils/simple_status'
import { isApplicationProvisioningUsersModified, isCustomApp } from '../fetch/types/application'
import { addBrandIdToRequest } from './types/email_domain'
import { SUB_CLAIM_NAME, isSubDefaultClaim, isSystemScope } from './types/authorization_servers'
import { isActiveGroupRuleChange } from './types/group_rules'
import { adjustRoleAdditionChange, isPermissionChangeOfAddedRole, shouldUpdateRolePermission } from './types/roles'
import { USER_ROLE_CHANGE_ID_FIELDS, getRoleIdFromSharedContext } from './types/user_roles'
import { adjustBrandCustomizationContent } from './types/brand'

const log = logger(module)

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [GROUP_TYPE_NAME]: { bulkPath: '/api/v1/groups' },
    [DOMAIN_TYPE_NAME]: { bulkPath: '/api/v1/domains' },
    [SMS_TEMPLATE_TYPE_NAME]: { bulkPath: '/api/v1/templates/sms' },
    [DEVICE_ASSURANCE_TYPE_NAME]: { bulkPath: '/api/v1/device-assurances' },
  })

  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    [BRAND_THEME_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            transformation: {
              omit: [ID_FIELD, LINKS_FIELD],
            },
          },
        },
        customizations: {
          add: [
            {
              // BrandThemes are created automatically by Okta when a Brand is created,
              // but we're allowing to "add" a theme alongside its Brand.
              // We first send a GET query to get its ID, and then we perform a "modify" action.
              request: {
                endpoint: {
                  path: '/api/v1/brands/{brandId}/themes',
                  method: 'get',
                },
                context: {
                  brandId: '{_parent.0.id}',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/brands/{brandId}/themes/{id}',
                  method: 'put',
                },
                context: {
                  brandId: '{_parent.0.id}',
                },
                transformation: {
                  omit: [ID_FIELD, LINKS_FIELD, 'logo', 'favicon'],
                },
              },
            },
          ],
          remove: [
            // BrandThemes are removed automatically by Okta when the Brand is removed.
            // We use an empty request list here to mark this action as supported in case a user removed the theme
            // alongside its Brand.
            // A separate Change Validator ensures that themes aren't removed by themselves.
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) => (isAdditionChange(change) ? ['add', 'modify'] : [change.action]),
      actionDependencies: [
        {
          first: 'add',
          second: 'modify',
        },
      ],
    },
    [AUTHORIZATION_POLICY]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{authorizationServerId}/policies',
                  method: 'post',
                },
                context: {
                  authorizationServerId: '{_parent.0.id}',
                },
              },
              copyFromResponse: {
                toSharedContext: simpleStatus.toSharedContext,
              },
            },
          ],
          modify: [
            {
              condition: simpleStatus.modificationCondition,
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{authorizationServerId}/policies/{id}',
                  method: 'put',
                },
                context: {
                  authorizationServerId: '{_parent.0.id}',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{authorizationServerId}/policies/{id}',
                  method: 'delete',
                },
                context: {
                  authorizationServerId: '{_parent.0.id}',
                },
              },
            },
          ],
          activate: [
            {
              condition: {
                custom: simpleStatus.activationCondition,
              },
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{authorizationServerId}/policies/{id}/lifecycle/activate',
                  method: 'post',
                },
                context: {
                  authorizationServerId: '{_parent.0.id}',
                },
              },
            },
          ],
          deactivate: [
            {
              condition: {
                custom: simpleStatus.deactivationCondition,
              },
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{authorizationServerId}/policies/{id}/lifecycle/deactivate',
                  method: 'post',
                },
                context: {
                  authorizationServerId: '{_parent.0.id}',
                },
              },
            },
          ],
        },
      },
      toActionNames: simpleStatus.toActionNames,
      actionDependencies: simpleStatus.actionDependencies,
    },
    [GROUP_RULE_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            transformation: { omit: ['status', 'allGroupsValid'] },
          },
        },
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/groups/rules',
                  method: 'post',
                },
              },
              copyFromResponse: {
                toSharedContext: simpleStatus.toSharedContext,
              },
            },
          ],
          modify: [
            {
              condition: simpleStatus.modificationCondition,
              request: {
                endpoint: {
                  path: '/api/v1/groups/rules/{id}',
                  method: 'put',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/groups/rules/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          activate: [
            {
              condition: {
                custom: simpleStatus.activationCondition,
              },
              request: {
                endpoint: {
                  path: '/api/v1/groups/rules/{id}/lifecycle/activate',
                  method: 'post',
                },
              },
            },
          ],
          deactivate: [
            {
              condition: {
                custom: simpleStatus.deactivationCondition,
              },
              request: {
                endpoint: {
                  path: '/api/v1/groups/rules/{id}/lifecycle/deactivate',
                  method: 'post',
                },
              },
            },
          ],
        },
      },
      toActionNames: async changeContext => {
        const { change } = changeContext
        if (isRemovalChange(change) && getChangeData(change).value.status !== INACTIVE_STATUS) {
          return ['deactivate', 'remove']
        }
        if (isActiveGroupRuleChange(change)) {
          return ['deactivate', 'modify', 'activate']
        }

        return simpleStatus.toActionNames(changeContext)
      },
      actionDependencies: [
        ...simpleStatus.actionDependencies,
        {
          first: 'deactivate',
          second: 'remove',
        },
      ],
    },
    [NETWORK_ZONE_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            transformation: {
              omit: ['status'],
            },
          },
        },
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/zones',
                  method: 'post',
                },
              },
              copyFromResponse: {
                toSharedContext: simpleStatus.toSharedContext,
              },
            },
          ],
          modify: [
            {
              condition: simpleStatus.modificationCondition,
              request: {
                endpoint: {
                  path: '/api/v1/zones/{id}',
                  method: 'put',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/zones/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          activate: [
            {
              condition: {
                custom: simpleStatus.activationCondition,
              },
              request: {
                endpoint: {
                  path: '/api/v1/zones/{id}/lifecycle/activate',
                  method: 'post',
                },
              },
            },
          ],
          deactivate: [
            {
              condition: {
                custom: simpleStatus.deactivationCondition,
              },
              request: {
                endpoint: {
                  path: '/api/v1/zones/{id}/lifecycle/deactivate',
                  method: 'post',
                },
              },
            },
          ],
        },
      },
      toActionNames: async changeContext => {
        // NetworkZone works like other "simple status" types, except it must
        // be deactivated before removal.
        const { change } = changeContext
        if (isRemovalChange(change)) {
          return ['deactivate', 'remove']
        }
        return simpleStatus.toActionNames(changeContext)
      },
      actionDependencies: [
        ...simpleStatus.actionDependencies,
        {
          first: 'deactivate',
          second: 'remove',
        },
      ],
    },
    [APPLICATION_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            transformation: {
              omit: [ID_FIELD, LINKS_FIELD, CUSTOM_NAME_FIELD],
            },
          },
        },
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps',
                  method: 'post',
                  queryArgs: {
                    // Whether to activate the app upon creation, default is true if omitted.
                    activate: '{activate}',
                  },
                },
                context: {
                  custom:
                    () =>
                    ({ change }) => ({
                      activate: getChangeData(change).value.status === INACTIVE_STATUS ? 'false' : 'true',
                    }),
                },
                transformation: {
                  omit: [
                    ID_FIELD,
                    LINKS_FIELD,
                    CUSTOM_NAME_FIELD,
                    ...APP_POLICIES,
                    ...APP_PROVISIONING_FIELD_NAMES,
                    API_SCOPES_FIELD_NAME,
                  ],
                },
              },
              copyFromResponse: {
                additional: {
                  adjust: async ({ value, context }) => {
                    const subdomain = await getSubdomainFromElementsSource(context.elementSource)
                    if (isCustomApp(value as Values, subdomain)) {
                      const createdAppName = _.get(value, NAME_FIELD)
                      return {
                        value: {
                          [CUSTOM_NAME_FIELD]: createdAppName,
                        },
                      }
                    }
                    return { value: {} }
                  },
                },
              },
            },
            ...createDeployAppPolicyRequests(),
          ],
          modify: [
            {
              condition: {
                skipIfIdentical: true,
                transformForCheck: {
                  omit: [...APP_POLICIES, ...APP_PROVISIONING_FIELD_NAMES, API_SCOPES_FIELD_NAME],
                },
              },
              request: {
                endpoint: {
                  path: '/api/v1/apps/{id}',
                  method: 'put',
                },
                transformation: {
                  // Override the default omit so we can read omitted field in `adjust`.
                  omit: [],
                  adjust: async ({ value, context }) => {
                    validatePlainObject(value, APPLICATION_TYPE_NAME)
                    const name = _.get(value, CUSTOM_NAME_FIELD)
                    if (!isModificationChange(context.change) || !isInstanceChange(context.change)) {
                      throw new Error('Change is not a modification change')
                    }
                    const transformed = getChangeData(
                      deployment.transformRemovedValuesToNull({ change: context.change, applyToPath: ['settings'] }),
                    ).value
                    return {
                      value: {
                        name,
                        ..._.omit(transformed, [
                          ID_FIELD,
                          LINKS_FIELD,
                          CUSTOM_NAME_FIELD,
                          ...APP_POLICIES,
                          ...APP_PROVISIONING_FIELD_NAMES,
                          API_SCOPES_FIELD_NAME,
                        ]),
                      },
                    }
                  },
                },
              },
            },
            ...createDeployAppPolicyRequests(),
            {
              condition: {
                custom: isApplicationProvisioningUsersModified,
              },
              request: {
                endpoint: {
                  path: '/api/v1/internal/apps/{id}/settings/importMatchRules',
                  client: 'private',
                  method: 'post',
                },
                transformation: {
                  root: 'applicationProvisioningUsers',
                  single: false,
                },
              },
              copyFromResponse: {
                updateServiceIDs: false,
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          activate: [
            {
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isActivationChange(change) ||
                    // Custom app must be activated before applying any other changes
                    isInactiveCustomAppChange(change),
              },
              request: {
                endpoint: {
                  path: '/api/v1/apps/{id}/lifecycle/activate',
                  method: 'post',
                },
              },
            },
          ],
          deactivate: [
            {
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    // Active apps must be deactivated before removal
                    (isRemovalChange(change) && getChangeData(change).value.status !== INACTIVE_STATUS) ||
                    isDeactivationChange(change) ||
                    // Custom apps must be activated before applying any other changes and deactivated before removal
                    isInactiveCustomAppChange(change),
              },
              request: {
                endpoint: {
                  path: '/api/v1/apps/{id}/lifecycle/deactivate',
                  method: 'post',
                },
              },
            },
          ],
        },
      },
      recurseIntoPath: [
        {
          fieldPath: ['applicationInboundProvisioning'],
          typeName: 'ApplicationInboundProvisioning',
          changeIdFields: [],
        },
        {
          fieldPath: ['applicationUserProvisioning'],
          typeName: 'ApplicationUserProvisioning',
          changeIdFields: [],
        },
        {
          fieldPath: ['applicationProvisioningGeneral'],
          typeName: 'ApplicationProvisioningGeneral',
          changeIdFields: [],
        },
        {
          fieldPath: [API_SCOPES_FIELD_NAME],
          typeName: 'OAuth2ScopeConsentGrant',
          changeIdFields: GRANTS_CHANGE_ID_FIELDS,
        },
      ],
      toActionNames: async ({ change }) => {
        if (isRemovalChange(change)) {
          return ['deactivate', 'remove']
        }
        if (isModificationChange(change)) {
          return ['activate', 'modify', 'deactivate']
        }
        return [change.action]
      },
      actionDependencies: [
        {
          first: 'deactivate',
          second: 'remove',
        },
        {
          first: 'activate',
          second: 'modify',
        },
        {
          first: 'modify',
          second: 'deactivate',
        },
      ],
    },
    ApplicationInboundProvisioning: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{parent_id}/connections/default/lifecycle/activate',
                  method: 'post',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{parent_id}/features/INBOUND_PROVISIONING',
                  method: 'put',
                },
                transformation: {
                  root: 'capabilities',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{parent_id}/connections/default/lifecycle/deactivate',
                  method: 'post',
                },
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) => {
        if (isAdditionChange(change)) {
          return ['add', 'modify']
        }
        return [change.action]
      },
    },
    ApplicationUserProvisioning: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{parent_id}/features/USER_PROVISIONING',
                  method: 'put',
                },
                transformation: {
                  root: 'capabilities',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) => {
        if (isAdditionChange(change)) {
          return ['add', 'modify']
        }
        return [change.action]
      },
    },
    ApplicationProvisioningGeneral: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/internal/apps/instance/{parent_id}/settings/user-mgmt-general',
                  client: 'private',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/internal/apps/instance/{parent_id}/settings/user-mgmt-general',
                  client: 'private',
                  method: 'post',
                },
                transformation: {
                  adjust: async ({ context }) => {
                    if (!isRemovalChange(context.change)) {
                      throw new Error('Change is not a removal change')
                    }
                    const valueBefore = context.change.data.before.value
                    return { value: { ...valueBefore, enabled: false } }
                  },
                },
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) => {
        if (isAdditionChange(change)) {
          return ['add', 'modify']
        }
        return [change.action]
      },
      actionDependencies: [
        {
          first: 'deactivate',
          second: 'remove',
        },
        {
          first: 'activate',
          second: 'modify',
        },
        {
          first: 'modify',
          second: 'deactivate',
        },
      ],
    },
    [APP_GROUP_ASSIGNMENT_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            transformation: {
              // These are synthetic fields that are not part of the API.
              // We use them to store service IDs in non-reference fields.
              omit: ['groupId', 'appId'],
            },
          },
        },
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{appId}/groups/{id}',
                  method: 'put',
                },
                context: {
                  appId: '{_parent.0.id}',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{appId}/groups/{id}',
                  method: 'put',
                },
                context: {
                  appId: '{_parent.0.id}',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{appId}/groups/{id}',
                  method: 'delete',
                },
                context: {
                  appId: '{_parent.0.id}',
                },
              },
            },
          ],
        },
      },
    },
    [APP_LOGO_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          // AppLogo deployment is handled by a filter.
          // We define actions here to avoid "action not supported" CV error. AppLogo doesn't support "remove" action,
          // so we can't add it to the CV ignore list.
          add: [
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
          modify: [
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
        },
      },
    },
    [BRAND_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/brands', method: 'post' },
                // Brand addition only requires the name field. Other fields
                // are set by a subsequent modify action.
                transformation: {
                  pick: ['name'],
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{id}', method: 'put' },
                transformation: {
                  adjust: async ({ value }) => {
                    validatePlainObject(value, BRAND_TYPE_NAME)
                    if (value.emailDomainId !== undefined && !_.isString(value.emailDomainId)) {
                      log.debug(
                        'Email domain ID is not a string, this is expected when an email domain is added alongside its brand. Removing email domain ID from request',
                      )
                    }
                    return {
                      value: {
                        ...value,
                        // When adding an email domain alongside its brand, the brand is added first, in which case the
                        // email domain ID won't be available in this request.
                        emailDomainId: _.isString(value.emailDomainId) ? value.emailDomainId : undefined,
                      },
                    }
                  },
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{id}', method: 'delete' },
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) => (isAdditionChange(change) ? ['add', 'modify'] : [change.action]),
      actionDependencies: [{ first: 'add', second: 'modify' }],
    },
    [SIGN_IN_PAGE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{parent_id}/pages/sign-in/customized', method: 'put' },
                transformation: { adjust: adjustBrandCustomizationContent },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{parent_id}/pages/sign-in/customized', method: 'put' },
                transformation: { adjust: adjustBrandCustomizationContent },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{parent_id}/pages/sign-in/customized', method: 'delete' },
              },
            },
          ],
        },
      },
    },
    [ERROR_PAGE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{parent_id}/pages/error/customized', method: 'put' },
                transformation: { adjust: adjustBrandCustomizationContent },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{parent_id}/pages/error/customized', method: 'put' },
                transformation: { adjust: adjustBrandCustomizationContent },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/brands/{parent_id}/pages/error/customized', method: 'delete' },
              },
            },
          ],
        },
      },
    },
    [EMAIL_DOMAIN_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/email-domains',
                  method: 'post',
                },
                transformation: {
                  adjust: addBrandIdToRequest,
                },
              },
            },
          ],
          modify: [
            {
              condition: {
                transformForCheck: {
                  // These are the only fields that can be modified.
                  pick: ['displayName', 'userName'],
                },
              },
              request: {
                endpoint: {
                  path: '/api/v1/email-domains/{id}',
                  method: 'put',
                },
                transformation: {
                  pick: ['displayName', 'userName'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/email-domains/{id}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
    },
    [USERTYPE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/meta/types/user', method: 'post' },
              },
              copyFromResponse: {
                additional: {
                  pick: [LINKS_FIELD],
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/meta/types/user/{id}', method: 'put' },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/meta/types/user/{id}', method: 'delete' },
              },
            },
          ],
        },
      },
    },
    User: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/users', method: 'post', queryArgs: { activate: '{activate}' } },
                context: {
                  custom:
                    () =>
                    ({ change }) => ({
                      // To create user in STAGED status, we need to provide 'activate=false' query param
                      activate: getChangeData(change).value.status === 'STAGED' ? 'false' : 'true',
                    }),
                },
              },
            },
          ],
          modify: [
            // activate user
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}/lifecycle/activate', method: 'post' },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isModificationChange(change) &&
                    ['STAGED', 'DEPROVISIONED'].includes(change.data.before.value.status) &&
                    getChangeData(change).value.status === 'PROVISIONED',
              },
            },
            // suspend user
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}/lifecycle/suspend', method: 'post' },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isModificationChange(change) &&
                    change.data.before.value.status === 'ACTIVE' &&
                    getChangeData(change).value.status === 'SUSPENDED',
              },
            },
            // unsuspend a user, and change its status to active
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}/lifecycle/unsuspend', method: 'post' },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isModificationChange(change) &&
                    change.data.before.value.status === 'SUSPENDED' &&
                    getChangeData(change).value.status === 'ACTIVE',
              },
            },
            // unlock a user, and change its status to active
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}/lifecycle/unlock', method: 'post' },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isModificationChange(change) &&
                    change.data.before.value.status === 'LOCKED_OUT' &&
                    getChangeData(change).value.status === 'ACTIVE',
              },
            },
            // update all user properties except status
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}', method: 'post' },
                transformation: { omit: ['status'] },
              },
              condition: {
                skipIfIdentical: true,
              },
            },
            // deactivate user, must be last because deactivated users cannot be updated
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}/lifecycle/deactivate', method: 'post' },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isModificationChange(change) &&
                    change.data.before.value.stauts !== 'DEPROVISIONED' &&
                    getChangeData(change).value.status === 'DEPROVISIONED',
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}/lifecycle/deactivate', method: 'post' },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    // user must be in status DEPROVISIONED before it can be deleted
                    getChangeData(change).value.status !== 'DEPROVISIONED',
              },
            },
            {
              request: {
                endpoint: { path: '/api/v1/users/{id}', method: 'delete' },
              },
            },
          ],
        },
      },
    },
    [USER_ROLES_TYPE_NAME]: {
      recurseIntoPath: [
        {
          typeName: 'UserRole',
          fieldPath: ['roles'],
          changeIdFields: USER_ROLE_CHANGE_ID_FIELDS.map(f => naclCase(f)),
        },
      ],
      requestsByAction: {
        default: { request: { earlySuccess: true } },
      },
    },
    UserRole: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/users/{userId}/roles', method: 'post' },
                context: { userId: '{_parent.0.user}' },
                transformation: {
                  adjust: async ({ value }) => {
                    validatePlainObject(value, USER_ROLES_TYPE_NAME)
                    if (value.type === 'CUSTOM') {
                      return {
                        value: _.pick(value, USER_ROLE_CHANGE_ID_FIELDS), // custom role payload
                      }
                    }
                    return { value: _.pick(value, ['type']) } // standard role payload
                  },
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/users/{userId}/roles/{id}', method: 'delete' },
                context: getRoleIdFromSharedContext,
              },
            },
          ],
        },
      },
    },
    OAuth2ScopeConsentGrant: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/apps/{parent_id}/grants', method: 'post' },
                transformation: {
                  adjust: async ({ value, context }) => {
                    validatePlainObject(value, 'OAuth2ScopeConsentGrant')
                    const domain = await getIssuerField(context.elementSource)
                    return {
                      value: {
                        ...value,
                        issuer: domain,
                      },
                    }
                  },
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/apps/{parent_id}/grants/{id}', method: 'delete' },
                context: getOAuth2ScopeConsentGrantIdFromSharedContext,
              },
            },
          ],
        },
      },
    },
    [IDENTITY_PROVIDER_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/idps', method: 'post' },
                transformation: { omit: ['status'] },
              },
              copyFromResponse: {
                toSharedContext: simpleStatus.toSharedContext,
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/idps/{id}', method: 'put' },
                transformation: { omit: ['status'] },
              },
              condition: simpleStatus.modificationCondition,
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/idps/{id}', method: 'delete' },
              },
            },
          ],
          activate: [
            {
              request: {
                endpoint: { path: '/api/v1/idps/{id}/lifecycle/activate', method: 'post' },
              },
              condition: {
                custom: simpleStatus.activationCondition,
              },
            },
          ],
          deactivate: [
            {
              request: {
                endpoint: { path: '/api/v1/idps/{id}/lifecycle/deactivate', method: 'post' },
              },
              condition: {
                custom: simpleStatus.deactivationCondition,
              },
            },
          ],
        },
      },
      toActionNames: simpleStatus.toActionNames,
      actionDependencies: simpleStatus.actionDependencies,
    },
    [JWK_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/idps/credentials/keys', method: 'post' },
                transformation: {
                  pick: ['x5c'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/idps/credentials/keys/{kid}', method: 'delete' },
              },
            },
          ],
        },
      },
    },
    [AUTHORIZATION_SERVER]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/authorizationServers', method: 'post' },
                transformation: { omit: ['status'] },
              },
              copyFromResponse: {
                toSharedContext: simpleStatus.toSharedContext,
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/authorizationServers/{id}', method: 'put' },
                transformation: { omit: ['status'] },
              },
              condition: simpleStatus.modificationCondition,
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/authorizationServers/{id}', method: 'delete' },
              },
            },
          ],
          activate: [
            {
              request: {
                endpoint: { path: '/api/v1/authorizationServers/{id}/lifecycle/activate', method: 'post' },
              },
              condition: {
                custom: simpleStatus.activationCondition,
              },
            },
          ],
          deactivate: [
            {
              request: {
                endpoint: { path: '/api/v1/authorizationServers/{id}/lifecycle/deactivate', method: 'post' },
              },
              condition: {
                custom: simpleStatus.deactivationCondition,
              },
            },
          ],
        },
      },
      toActionNames: simpleStatus.toActionNames,
      actionDependencies: simpleStatus.actionDependencies,
    },
    OAuth2Scope: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/scopes',
                  method: 'post',
                },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    !isSystemScope(change),
              },
            },
            // This request retrieves system scopes that are automatically created when an authorization server is created.
            // We use a GET request to fetch the scope ID, and then subsequently modify it to match the requested values.
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/scopes',
                  method: 'get',
                  // scopes names are unique within an authorization server
                  queryArgs: { q: '{name}' },
                },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isSystemScope(change),
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/scopes/{id}',
                  method: 'put',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/scopes/{id}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) =>
        isAdditionChange(change) && isSystemScope(change) ? ['add', 'modify'] : [change.action],
      actionDependencies: [{ first: 'add', second: 'modify' }],
    },
    OAuth2Claim: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/claims',
                  method: 'post',
                },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    !isSubDefaultClaim(change),
              },
            },
            // This request retrieves the "sub" default claim that is automatically created when an authorization server is created.
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/claims',
                  method: 'get',
                  queryArgs: { includeClaims: SUB_CLAIM_NAME },
                },
              },
              condition: {
                custom:
                  () =>
                  ({ change }) =>
                    isSubDefaultClaim(change),
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/claims/{id}',
                  method: 'put',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/authorizationServers/{parent_id}/claims/{id}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
      toActionNames: async ({ change }) =>
        isAdditionChange(change) && isSubDefaultClaim(change) ? ['add', 'modify'] : [change.action],
      actionDependencies: [{ first: 'add', second: 'modify' }],
    },
    [EMAIL_TEMPLATE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              // EmailTemplates are created automatically by Okta when a Brand is created,
              // we send GET request to the EmailTemplate to verify it was created.
              request: {
                endpoint: {
                  path: '/api/v1/brands/{parent_id}/templates/email/{name}',
                  method: 'get',
                },
              },
              copyFromResponse: {
                additional: {
                  // assign brandId to the element, to be used by following EmailCustomization requests
                  adjust: async ({ context: { change } }) => {
                    const brandId = getParents(getChangeData(change))?.[0]?.id // parent is already resolved
                    if (!_.isString(brandId)) {
                      log.warn(
                        'failed to assign brandId to EmailTemplate: %s',
                        getChangeData(change).elemID.getFullName(),
                      )
                    }
                    return { value: { brandId } }
                  },
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/brands/{parent_id}/templates/email/{name}/settings',
                  method: 'put',
                },
                transformation: {
                  root: 'settings',
                },
              },
              condition: { skipIfIdentical: true, transformForCheck: { root: 'settings' } },
            },
          ],
          // EmailTemplates are removed automatically by Okta when the Brand is removed.
          // A separate Change Validator ensures that templates aren't removed by themselves.
          remove: [{ request: { earlySuccess: true } }],
        },
      },
      toActionNames: async ({ change }) => (isAdditionChange(change) ? ['add', 'modify'] : [change.action]),
      actionDependencies: [{ first: 'add', second: 'modify' }],
    },
    [EMAIL_CUSTOMIZATION_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/brands/{brandId}/templates/email/{templateName}/customizations',
                  method: 'post',
                },
                context: {
                  brandId: '{_parent.0.brandId}',
                  templateName: '{_parent.0.name}',
                },
                transformation: { adjust: adjustBrandCustomizationContent },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/brands/{brandId}/templates/email/{templateName}/customizations/{id}',
                  method: 'put',
                },
                context: {
                  brandId: '{_parent.0.brandId}',
                  templateName: '{_parent.0.name}',
                },
                transformation: { adjust: adjustBrandCustomizationContent },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/brands/{brandId}/templates/email/{templateName}/customizations/{id}',
                  method: 'delete',
                },
                context: {
                  brandId: '{_parent.0.brandId}',
                  templateName: '{_parent.0.name}',
                },
              },
            },
          ],
        },
      },
    },
    [PROFILE_MAPPING_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              // ProfileMappings are created automatically by Okta when a source / target instance is created,
              // but we're allowing to "add" a mapping alongside its parents.
              // We first send a GET query to get its ID, and then we perform a "modify" action.
              request: {
                endpoint: {
                  path: '/api/v1/mappings',
                  queryArgs: {
                    sourceId: '{source.id}',
                    targetId: '{target.id}',
                  },
                  method: 'get',
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/api/v1/mappings/{id}',
                  method: 'post',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/mappings/{id}',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            // ProfileMappings are removed automatically by Okta when either side of the mapping is removed.
            // We use an empty URL here to mark this action as supported in case a user removed the mapping
            // alongside either side.
            // A separate Change Validator ensures that mappings aren't removed by themselves.
            // A separate filter verifies that mappings are actually deleted by Okta.
            {
              request: {
                earlySuccess: true,
              },
            },
          ],
        },
      },
    },
    [ROLE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/iam/roles', method: 'post' },
                transformation: {
                  adjust: adjustRoleAdditionChange,
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/iam/roles/{id}', method: 'put' },
                transformation: { omit: ['id', 'permissions'] },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/iam/roles/{id}', method: 'delete' },
              },
            },
          ],
        },
      },
      recurseIntoPath: [
        {
          fieldPath: ['permissions'],
          typeName: 'Permission',
          changeIdFields: ['label'],
          onActions: ['add', 'modify'],
        },
      ],
    },
    Permission: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: { path: '/api/v1/iam/roles/{parent_id}/permissions/{label}', method: 'post' },
                transformation: { omit: ['label'] },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: { path: '/api/v1/iam/roles/{parent_id}/permissions/{label}', method: 'put' },
                transformation: { omit: ['label'] },
              },
              condition: {
                custom: shouldUpdateRolePermission,
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: { path: '/api/v1/iam/roles/{parent_id}/permissions/{label}', method: 'delete' },
              },
            },
          ],
        },
      },
      toActionNames: async ({ change, changeGroup }) => {
        if (isAdditionChange(change) && isPermissionChangeOfAddedRole(change, changeGroup)) {
          return ['modify']
        }
        return [change.action]
      },
    },
  }

  return _.merge(standardRequestDefinitions, customDefinitions)
}

export const createDeployDefinitions = (): DeployApiDefinitions => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
          },
          copyFromResponse: {
            updateServiceIDs: true,
          },
        },
      },
      referenceResolution: {
        when: 'early',
      },
    },
    customizations: createCustomizations(),
  },
  dependencies: [
    {
      first: { type: ROLE_TYPE_NAME, action: 'add' },
      second: { type: 'Permission', action: 'modify' },
    },
  ],
})
