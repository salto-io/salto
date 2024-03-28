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
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/{roleId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/{roleId}',
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
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains',
                  method: 'post',
                },
                transformation: {
                  omit: ['verified', 'isPrimary'],
                },
              },
              copyFromResponse: {
                pick: ['verified', 'isPrimary'],
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains/{domainName}',
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
          //         path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains/{domainName}',
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
                  path: 'https://admin.googleapis.com/admin/directory/v1/groups',
                  method: 'post',
                },
                transformation: {
                  omit: ['adminCreated', 'nonEditableAliases', 'groupSettings'],
                },
              },
              copyFromResponse: {
                pick: ['adminCreated', 'nonEditableAliases'],
              },
            },
            {
              request: {
                endpoint: {
                  path: 'https://www.googleapis.com/groups/v1/groups/{email}',
                  method: 'put',
                },
                transformation: {
                  root: 'groupSettings',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/groups/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/groups/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['adminCreated', 'nonEditableAliases'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: 'https://www.googleapis.com/groups/v1/groups/{email}',
                  method: 'put',
                },
                transformation: {
                  root: 'groupSettings',
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
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits{orgUnitPath}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits{orgUnitPath}',
                  method: 'put',
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
          // We are only able to create role assignment for security groups
          add: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments',
                  method: 'post',
                },
              },
            },
          ],
          // there is no way to edit role assignment
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments/{roleAssignmentId}',
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
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/schemas',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/schemas/{schemaId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/schemas/{schemaId}',
                  method: 'put',
                },
              },
            },
          ],
        },
      },
    },
    building: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/buildings',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/buildings/{buildingId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/buildings/{buildingId}',
                  method: 'put',
                },
              },
            },
          ],
        },
      },
    },
    room: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/calendars',
                  method: 'post',
                },
                transformation: {
                  // we should run over the current resource id and change it to the resource name
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/calenders/{resourceId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/resources/calenders/{resourceId}',
                  method: 'put',
                },
              },
            },
          ],
        },
      },
    },
    feature: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/features',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/features/{name}',
                  method: 'delete',
                },
              },
            },
          ],
          // modify: [
          //   {
          //     request: {
          //       endpoint: {
          //         path: 'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/features/{name}/rename',
          //         method: 'put',
          //       },
          //       transformation: {
          //         root: 'name',
          //         nestUnderField: 'newName',
          //         adjust: item => ({ value: { nawName: item.value.name } }),
          //       },
          //     },
          //   },
          // ],
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
