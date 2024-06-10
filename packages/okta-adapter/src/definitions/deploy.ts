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

import { definitions, deployment } from '@salto-io/adapter-components'
import { AdditionalAction, ClientOptions } from './types'
import { APPLICATION_TYPE_NAME, GROUP_TYPE_NAME, INACTIVE_STATUS } from '../constants'
import {
  getChangeData,
  isAdditionChange,
  isModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import {
  isActivationChange, isDeactivationChange,
  isInactiveCustomAppChange,
  shouldActivateAfterChange, shouldDeactivateAfterChange,
  shouldDeactivateBeforeChange,
} from '../deployment'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

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
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/api/v1/apps',
                method: 'post',
                queryArgs: {
                  activate: '{activate}',
                },
              },
              context: {
                custom: () => ({ change }) => ({
                  activate: getChangeData(change).value.status === INACTIVE_STATUS ? 'false' : 'true',
                }),
              },
            },
            // TODO: Is this merged? Should I also copy service Id here?
            copyFromResponse: {
              toSharedContext: {
                pick: ['status'],
                single: true,
                nestUnderElemID: true,
              },
            },
          },
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
            },
          },
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
              custom: () => (changeAndContext) => {
                const { change } = changeAndContext
                return isModificationChange(change) &&
                  (isActivationChange({
                      before: change.data.before.value.status,
                      after: change.data.after.value.status,
                    }) ||
                    // Custom app must be activated before applying any other changes
                    isInactiveCustomAppChange(changeAndContext))
              },
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
              custom: () => (changeAndContext) => {
                const { change } = changeAndContext
                return isModificationChange(change) &&
                  (isDeactivationChange({
                      before: change.data.before.value.status,
                      after: change.data.after.value.status
                    }) ||
                    isInactiveCustomAppChange(changeAndContext))
              }
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
      if (isAdditionChange(change)) {
        return ['add', 'activate']
      }
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
        first: 'add',
        second: 'activate',
      },
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
