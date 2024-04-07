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
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { v4 as uuidv4 } from 'uuid'
import { AdditionalAction, ClientOptions } from '../types'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    // TODO - SALTO-5733 - generalize the InstanceDeployApiDefinitions
    role: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/roles',
                  method: 'post',
                },
                transformation: {
                  // add CV to inform the user that this fields are read-only
                  omit: ['isSuperAdminRole', 'isSystemRole'],
                },
              },
              copyFromResponse: {
                additional: { pick: ['isSuperAdminRole', 'isSystemRole'] },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/roles/{roleId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/roles/{roleId}',
                  method: 'put',
                },
                transformation: {
                  // add CV to inform the user that this fields are read-only
                  omit: ['isSuperAdminRole', 'isSystemRole'],
                },
              },
              copyFromResponse: {
                additional: { pick: ['isSuperAdminRole', 'isSystemRole'] },
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
                  path: '/admin/directory/v1/customer/my_customer/domains',
                  method: 'post',
                },
                transformation: {
                  // add CV to inform the user that this fields are read-only
                  omit: ['verified', 'isPrimary'],
                },
              },
              copyFromResponse: {
                additional: { pick: ['verified', 'isPrimary'] },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/domains/{domainName}',
                  method: 'delete',
                },
              },
            },
          ],
          // We are only able to edit the domainAliases
          // TODO SALTO-5728 - For that we are waiting for a new infra func that deals with changes inside of field array
          // maybe we need CV as well here to be sure we are not changing anything else
          // modify: [
          //   {
          //     request: {
          //       endpoint: {
          //         path: '/admin/directory/v1/customer/my_customer/domains/{domainName}',
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
                  path: '/admin/directory/v1/groups',
                  method: 'post',
                },
                transformation: {
                  // add CV to inform the user that this fields are read-only
                  omit: ['adminCreated', 'nonEditableAliases', 'groupSettings'],
                },
              },
              copyFromResponse: {
                additional: { pick: ['adminCreated', 'nonEditableAliases'] },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/groups/v1/groups/{email}',
                  method: 'put',
                  client: 'groupSettings',
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
                  path: '/admin/directory/v1/groups/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/groups/{id}',
                  method: 'put',
                },
                transformation: {
                  // add CV to inform the user that this fields are read-only
                  omit: ['adminCreated', 'nonEditableAliases', 'groupSettings'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/groups/v1/groups/{email}',
                  method: 'put',
                  client: 'groupSettings',
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
                  path: '/admin/directory/v1/customer/my_customer/orgunits',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/orgunits{orgUnitPath}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/orgunits{orgUnitPath}',
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
                  path: '/admin/directory/v1/customer/my_customer/roleassignments',
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
                  path: '/admin/directory/v1/customer/my_customer/roleassignments/{roleAssignmentId}',
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
                  path: '/admin/directory/v1/customer/my_customer/schemas',
                  method: 'post',
                },
                transformation: {
                  adjust: item => {
                    const { value } = item
                    if (!(lowerdashValues.isPlainRecord(value) && lowerdashValues.isPlainRecord(value.fields))) {
                      throw new Error('Expected schema to be an object')
                    }
                    return {
                      value: {
                        ...value,
                        fields: Object.values(value.fields),
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
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/schemas/{schemaId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/schemas/{schemaId}',
                  method: 'put',
                },
                transformation: {
                  adjust: item => {
                    const { value } = item
                    if (!(lowerdashValues.isPlainRecord(value) && lowerdashValues.isPlainRecord(value.fields))) {
                      throw new Error('Expected schema to be an object')
                    }
                    return {
                      value: {
                        ...value,
                        fields: Object.values(value.fields),
                      },
                    }
                  },
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
                  path: '/admin/directory/v1/customer/my_customer/resources/buildings',
                  method: 'post',
                },
                transformation: {
                  adjust: item => {
                    const { value } = item
                    if (!lowerdashValues.isPlainRecord(value)) {
                      throw new Error('Can not deploy when the value is not an object')
                    }
                    return {
                      value: {
                        ...value,
                        buildingId: uuidv4(),
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
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/resources/buildings/{buildingId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/resources/buildings/{buildingId}',
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
                  path: '/admin/directory/v1/customer/my_customer/resources/calendars',
                  method: 'post',
                },
                transformation: {
                  // add CV to inform the user that this fields are read-only
                  omit: ['resourceEmail'],
                  adjust: item => {
                    const { value } = item
                    if (!lowerdashValues.isPlainRecord(value)) {
                      throw new Error('Can not deploy when the value is not an object')
                    }
                    return {
                      value: {
                        ...value,
                        resourceId: uuidv4(),
                      },
                    }
                  },
                },
              },
              copyFromResponse: {
                additional: { pick: ['resourceEmail'] },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/resources/calendars/{resourceId}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/resources/calendars/{resourceId}',
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
                  path: '/admin/directory/v1/customer/my_customer/resources/features',
                  method: 'post',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/admin/directory/v1/customer/my_customer/resources/features/{name}',
                  method: 'delete',
                },
              },
            },
          ],
          // TODO - SAAS-10775 - check how to use the old name field in the URL
          // modify: [
          //   {
          //     request: {
          //       endpoint: {
          //         path: '/admin/directory/v1/customer/my_customer/features/{name}/rename',
          //         method: 'put',
          //       },
          //       transformation: {
          //         root: 'name',
          //         nestUnderField: 'newName',
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
