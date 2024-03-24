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
import { AdditionalAction, ClientOptions } from '../types'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

// TODO example - adjust and remove irrelevant definitions. check @adapter-components/deployment for helper functions

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    role: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/roles',
                  method: 'post',
                },
                transformation: {
                  omit: ['roleId'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/roles/{roleId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/roles/{roleId}',
                  method: 'put',
                },
              },
            },
          ],
        },
      },
    },
    domain: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/domains',
                  method: 'post',
                },
                transformation: {
                  omit: ['verified', 'isPrimary'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/domains/{domainName}',
                  method: 'delete',
                },
              },
            },
          ],
          // Wea are only able to edit the domainAliases
          // For that we are waiting for a new infra func that dills with changes inside of field array
          // modify: [
          //   {
          //     request: {
          //       endpoint: {
          //         path: '/customer/my_customer/domains/{domainName}',
          //         method: 'put',
          //       },
          //     },
          //   },
          // ],
        },
      },
    },
    group: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/groups',
                  method: 'post',
                },
                transformation: {
                  omit: ['id', 'directMembersCount', 'adminCreated'],
                },
              },
              copyFromResponse: {
                pick: ['directMembersCount', 'adminCreated'],
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
          modify: [
            {
              request: {
                endpoint: {
                  path: '/groups/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['directMembersCount', 'adminCreated', 'nonEditableAliases'],
                },
              },
            },
          ],
        },
      },
    },
    orgUnit: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/orgunits',
                  method: 'post',
                },
                transformation: {
                  omit: ['orgUnitPath', 'orgUnitId'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/orgunits{orgUnitPath}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/orgunits{orgUnitPath}',
                  method: 'put',
                },
                transformation: {
                  omit: ['orgUnitId'],
                },
              },
            },
          ],
        },
      },
    },
    roleAssignment: {
      requestsByAction: {
        customizations: {
          // At the moment we did not decide how to handle the user reference
          // But we aer only able to create role assignment reference to security groups
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/roleassignments',
                  method: 'post',
                },
                transformation: {
                  omit: ['roleAssignmentId'],
                },
              },
            },
          ],
          // there is noway to edit role assignment
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/roleassignments/{roleAssignmentId}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
    },
    schema: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/schemas',
                  method: 'post',
                },
                transformation: {
                  omit: ['schemaId'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/schemas/{schemaId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/schemas/{schemaId}',
                  method: 'put',
                },
              },
            },
          ],
        },
      },
    },
    buildingResource: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/resources/buildings',
                  method: 'post',
                },
                transformation: {
                  omit: ['buildingId'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/resources/buildings/{buildingId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/resources/buildings/{buildingId}',
                  method: 'put',
                },
              },
            },
          ],
        },
      },
    },
    calenderResource: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/resources/calenders',
                  method: 'post',
                },
                transformation: {
                  omit: ['calenderId'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/resources/calenders/{resourceId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/customer/my_customer/resources/calenders/{resourceId}',
                  method: 'put',
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
  dependencies: [],
})
