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
import { AdditionalAction, ClientOptions } from './types'
import { APPLICATION_TYPE_NAME, CUSTOM_NAME_FIELD, GROUP_TYPE_NAME, INACTIVE_STATUS } from '../constants'
import {
  getChangeData,
  isModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import {
  isActivationChange, isDeactivationChange,
  isInactiveCustomAppChange,
} from '../deployment'
import { isDefined } from '@salto-io/lowerdash/dist/src/values'
import {
  DeployableRequestDefinition,
  DeployRequestDefinition,
} from '@salto-io/adapter-components/dist/src/definitions/system/deploy'
import Cli from '@salto-io/e2e-credentials-store/dist/src/cli'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

/**
 * Create a deploy request for setting a policy associated with an `Application`.
 */
const createDeployAppPolicyRequest = (policyName: string): DeployableRequestDefinition<ClientOptions> => ({
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

/**
 * Create deploy requests for setting all policies associated with an `Application`.
 */
const createDeployAppPolicyRequests = (): DeployableRequestDefinition<ClientOptions>[] => [
  createDeployAppPolicyRequest('accessPolicy'),
  createDeployAppPolicyRequest('profileEnrollment'),
]

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => ({
  [GROUP_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/api/v1/groups',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/api/v1/groups/{groupId}',
                method: 'put',
              },
              context: {
                groupId: 'id',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/api/v1/groups/{groupId}',
                method: 'delete',
              },
              context: {
                groupId: '{id}',
              },
            },
          },
        ],
      },
    },
  },
  [APPLICATION_TYPE_NAME]: {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            omit: ['id', '_links', CUSTOM_NAME_FIELD],
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
            /*
            copyFromResponse: {
              additional: {
                adjust: ({value, context}) => {

                },
              },
            },
            */
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
                adjust: ({ value }) => ({
                  value: {
                    name: _.get(value, 'customName'),
                  }
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
})

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
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(),
  },
  dependencies: [],
})
