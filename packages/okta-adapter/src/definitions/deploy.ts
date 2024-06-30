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
import { getChangeData, isModificationChange } from '@salto-io/adapter-api'
import { AdditionalAction, ClientOptions } from './types'
import {
  BRAND_TYPE_NAME,
  DEVICE_ASSURANCE_TYPE_NAME,
  DOMAIN_TYPE_NAME,
  GROUP_TYPE_NAME,
  SMS_TEMPLATE_TYPE_NAME,
  USERTYPE_TYPE_NAME,
} from '../constants'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [GROUP_TYPE_NAME]: { bulkPath: '/api/v1/groups' },
    [BRAND_TYPE_NAME]: { bulkPath: '/api/v1/brands' },
    // [DOMAIN_TYPE_NAME]: { bulkPath: '/api/v1/domains' },
    // [USERTYPE_TYPE_NAME]: { bulkPath: '/api/v1/meta/types/user' },
    // [SMS_TEMPLATE_TYPE_NAME]: { bulkPath: '/api/v1/templates/sms' },
    // [DEVICE_ASSURANCE_TYPE_NAME]: { bulkPath: '/api/v1/device-assurances' },
  })

  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    /*
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
                  pick: ['_links']
                }
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
        }
      },
    },

     */
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
