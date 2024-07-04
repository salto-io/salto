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
import { values } from '@salto-io/lowerdash'
import { definitions, deployment } from '@salto-io/adapter-components'
import { getChangeData, isModificationChange, isRemovalChange, Values } from '@salto-io/adapter-api'
import { AdditionalAction, ClientOptions } from './types'
import {
  APPLICATION_TYPE_NAME,
  BRAND_TYPE_NAME, CUSTOM_NAME_FIELD,
  DEVICE_ASSURANCE_TYPE_NAME,
  DOMAIN_TYPE_NAME,
  GROUP_TYPE_NAME, INACTIVE_STATUS,
  LINKS_FIELD,
  SMS_TEMPLATE_TYPE_NAME,
  USERTYPE_TYPE_NAME,
} from '../constants'
import {
  getSubdomainFromElementsSource,
  isActivationChange,
  isDeactivationChange,
  isInactiveCustomAppChange,
} from '../deployment'
import { ID_FIELD, NAME_FIELD } from '@salto-io/netsuite-adapter/dist/src/constants'
import { isCustomApp } from '../filters/app_deployment'

const { isDefined } = values


type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>


/**
 * Create a deploy request for setting a policy associated with an `Application`.
 */
const createDeployAppPolicyRequest = (policyName: string): definitions.deploy.DeployableRequestDefinition<ClientOptions> => ({
  condition: {
    custom: () => ({ change }) =>
      isDefined(_.get(getChangeData(change).value, policyName)),
  },
  request: {
    endpoint: {
      path: '/api/v1/apps/{source}/policies/{target}',
      method: 'put',
    },
    context: {
      source: '{id}',
      target: `{${policyName}}`,
    },
  },
})

const createDeployAppPolicyRequests = (): definitions.deploy.DeployableRequestDefinition<ClientOptions>[] => [
  createDeployAppPolicyRequest('accessPolicy'),
  createDeployAppPolicyRequest('profileEnrollment'),
]

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [GROUP_TYPE_NAME]: { bulkPath: '/api/v1/groups' },
    [BRAND_TYPE_NAME]: { bulkPath: '/api/v1/brands' },
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
                  custom: () => ({ change }) => ({
                    activate: getChangeData(change).value.status === INACTIVE_STATUS ? 'false' : 'true',
                  }),
                },
              },
              copyFromResponse: {
                additional: {
                  adjust: async ({value, context}) => {
                    const subdomain = await getSubdomainFromElementsSource(context.elementsSource)
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
              request: {
                endpoint: {
                  path: '/api/v1/apps/{applicationId}',
                  method: 'put',
                },
                context: {
                  applicationId: '{id}',
                },
                transformation: {
                  adjust: async ({ value }) => ({
                    value: {
                      name: _.get(value, CUSTOM_NAME_FIELD),
                    },
                  }),
                },
              },
            },
            ...createDeployAppPolicyRequests(),
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/apps/{applicationId}',
                  method: 'delete',
                },
                context: {
                  applicationId: '{id}',
                },
              },
            },
          ],
          activate: [
            {
              condition: {
                custom: () => ({ change }) =>
                  isActivationChange(change) ||
                  // Custom app must be activated before applying any other changes
                  isInactiveCustomAppChange(change),
              },
              request: {
                endpoint: {
                  path: '/api/v1/apps/{applicationId}/lifecycle/activate',
                  method: 'post',
                },
                context: {
                  applicationId: '{id}',
                },
              },
            },
          ],
          deactivate: [
            {
              condition: {
                custom: () => ({ change }) =>
                  isDeactivationChange(change) ||
                  // Custom app must be activated before applying any other changes
                  isInactiveCustomAppChange(change),
              },
              request: {
                endpoint: {
                  path: '/api/v1/apps/{applicationId}/lifecycle/deactivate',
                  method: 'post',
                },
                context: {
                  applicationId: '{id}',
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
