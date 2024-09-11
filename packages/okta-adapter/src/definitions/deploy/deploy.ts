/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions, deployment } from '@salto-io/adapter-components'
import {
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isRemovalChange,
  Values,
} from '@salto-io/adapter-api'
import { validatePlainObject } from '@salto-io/adapter-utils'
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
} from '../../constants'
import {
  APP_POLICIES,
  createDeployAppPolicyRequests,
  getSubdomainFromElementsSource,
  isInactiveCustomAppChange,
} from './types/application'
import { isActivationChange, isDeactivationChange } from './utils/status'
import * as simpleStatus from './utils/simple_status'
import { isCustomApp } from '../fetch/types/application'
import { addBrandIdToRequest } from './types/email_domain'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

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
      toActionNames: ({ change }) => (isAdditionChange(change) ? ['add', 'modify'] : [change.action]),
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
      toActionNames: changeContext => {
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
                  omit: [ID_FIELD, LINKS_FIELD, CUSTOM_NAME_FIELD, ...APP_POLICIES],
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
                  omit: APP_POLICIES,
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
                        ..._.omit(transformed, [ID_FIELD, LINKS_FIELD, CUSTOM_NAME_FIELD, ...APP_POLICIES]),
                      },
                    }
                  },
                },
              },
            },
            ...createDeployAppPolicyRequests(),
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
      toActionNames: ({ change }) => {
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
      toActionNames: ({ change }) => (isAdditionChange(change) ? ['add', 'modify'] : [change.action]),
      actionDependencies: [{ first: 'add', second: 'modify' }],
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
  dependencies: [],
})
