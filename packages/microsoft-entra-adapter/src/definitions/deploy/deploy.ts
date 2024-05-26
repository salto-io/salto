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
import { isAdditionChange, isRemovalChange } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import {
  APPLICATION_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  GROUP_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
} from '../../constants'
import { AdditionalAction, ClientOptions } from '../types'
import { GRAPH_BETA_PATH, GRAPH_V1_PATH } from '../requests/clients'

const { isPlainObject } = values

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
type DeployRequestDefinition = definitions.deploy.DeployRequestDefinition<ClientOptions>
type DeployCustomDefinitions = Record<string, InstanceDeployApiDefinitions>

const APPLICATION_MODIFICATION_REQUEST: DeployRequestDefinition = {
  endpoint: {
    path: '/applications/{id}',
    method: 'patch',
  },
  transformation: {
    omit: ['appId', 'publisherDomain', 'applicationTemplateId'],
  },
}

const createCustomizationsWithBasePath = (
  customizations: DeployCustomDefinitions,
  basePath: string,
): DeployCustomDefinitions =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requestsByAction: {
      ...customization.requestsByAction,
      customizations: {
        ..._.mapValues(customization.requestsByAction?.customizations, actionCustomizations =>
          (actionCustomizations ?? []).map(action => ({
            ...action,
            request: {
              ...action.request,
              ...((action.request.endpoint
                ? { endpoint: { ...action.request.endpoint, path: `${basePath}${action.request.endpoint.path}` } }
                : {}) as DeployRequestDefinition['endpoint']),
            },
          })),
        ),
      },
    },
  }))

const graphV1CustomDefinitions: DeployCustomDefinitions = {
  [CONDITIONAL_ACCESS_POLICY_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/policies',
                method: 'post',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/policies/{id}',
                method: 'delete',
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
                path: '/applications',
                method: 'post',
              },
              transformation: {
                pick: ['displayName'],
              },
            },
            copyFromResponse: {
              toSharedContext: {
                pick: ['id'],
              },
            },
          },
          {
            request: {
              ...APPLICATION_MODIFICATION_REQUEST,
              context: {
                sharedContext: {
                  id: 'id',
                },
              },
            },
          },
        ],
        modify: [
          {
            request: APPLICATION_MODIFICATION_REQUEST,
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/applications/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [SERVICE_PRINCIPAL_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/servicePrincipals',
                method: 'post',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/servicePrincipals/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [GROUP_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/groups',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/groups/{id}',
                method: 'patch',
              },
            },
            condition: {
              transformForCheck: {
                omit: ['appRoleAssignments'],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/groups/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/groups/{groupId}/appRoleAssignments',
                method: 'post',
              },
              transformation: {
                omit: ['id'],
                adjust: item => {
                  if (!isPlainObject(item.value) || !isAdditionChange(item.context.change)) {
                    throw new Error('Unexpected value, expected a plain object')
                  }
                  return {
                    value: {
                      ...item.value,
                      // TODO: Add validation. Maybe a CV or check the id exists.
                      principalId: getParent(item.context.change.data.after).value.id,
                    },
                  }
                },
              },
              context: {
                custom:
                  () =>
                  ({ change }) => {
                    if (!isAdditionChange(change)) {
                      throw new Error('Unexpected change, expected an addition change')
                    }
                    return {
                      groupId: getParent(change.data.after).value.id,
                    }
                  },
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/groups/{groupId}/appRoleAssignments/{id}',
                method: 'delete',
              },
              context: {
                custom:
                  () =>
                  ({ change }) => {
                    if (!isRemovalChange(change)) {
                      throw new Error('Unexpected change, expected a removal change')
                    }
                    return {
                      groupId: getParent(change.data.before).value.id,
                    }
                  },
              },
            },
          },
        ],
      },
    },
  },
}
const graphBetaCustomDefinitions: DeployCustomDefinitions = {
  [AUTHENTICATION_METHOD_POLICY_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        modify: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy',
                method: 'patch',
              },
            },
          },
        ],
      },
    },
  },
  [AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/{id}',
                method: 'patch',
              },
              transformation: {
                omit: ['displayName'],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
}

const createCustomizations = (): DeployCustomDefinitions => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})

  return _.merge(standardRequestDefinitions, {
    ...createCustomizationsWithBasePath(graphV1CustomDefinitions, GRAPH_V1_PATH),
    ...createCustomizationsWithBasePath(graphBetaCustomDefinitions, GRAPH_BETA_PATH),
  })
}

export const createDeployDefinitions = (): definitions.deploy.DeployApiDefinitions<never, ClientOptions> => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
          },
        },
        customizations: {},
      },
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(),
  },
})
