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
} from '../../constants'
import {
  APP_POLICIES,
  createDeployAppPolicyRequests,
  getSubdomainFromElementsSource,
  isInactiveCustomAppChange,
} from './types/application'
import { isActivationChange, isDeactivationChange } from './utils/status'
import { isCustomApp } from '../fetch/types/application'

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
                    if (subdomain !== undefined && isCustomApp(value as Values, subdomain)) {
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
                      deployment.transformRemovedValuesToNull(context.change, ['settings']),
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
