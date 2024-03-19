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
import { Change, InstanceElement, Value, isModificationChange } from '@salto-io/adapter-api'
import { AdditionalAction, ClientOptions } from '../types'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const getPermissionsDiff = (
  change: Change<InstanceElement>,
): { deletedPermissions: Value[]; addedPermissions: Value[] } => {
  if (!isModificationChange(change)) {
    return { deletedPermissions: [], addedPermissions: [] }
  }
  const { permissions: beforePermissions } = _.pickBy(change.data.before.value, 'permissions')
  const { permissions: afterPermissions } = _.pickBy(change.data.after.value, 'permissions')
  if (!Array.isArray(beforePermissions) || !Array.isArray(afterPermissions)) {
    return { deletedPermissions: [], addedPermissions: [] }
  }
  return {
    deletedPermissions: beforePermissions.filter(before => !afterPermissions.includes(before)),
    addedPermissions: afterPermissions.filter(after => !beforePermissions.includes(after)),
  }
}

const isSpaceChange = ({ change }: definitions.deploy.ChangeAndContext): boolean => {
  if (!isModificationChange(change)) {
    return false
  }
  return !_.isEqual(_.omitBy(change.data.before.value, 'permissions'), _.omitBy(change.data.after.value, 'permissions'))
}

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    space: { bulkPath: '/wiki/rest/api/space', idField: 'key' },
    blogpost: { bulkPath: 'wiki/api/v2/blogposts', idField: 'id' },
  })
  // TODO_F each definition in its own file
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    page: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/wiki/api/v2/pages',
                  method: 'post',
                },
                transformation: {
                  omit: ['restriction', 'version'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/content/{id}/restriction',
                  method: 'post',
                },
                transformation: {
                  root: 'restriction',
                  nestUnderField: 'results',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/wiki/api/v2/pages/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['restriction, version'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/wiki/api/v2/pages/{id}',
                  method: 'delete',
                },
                transformation: {
                  omit: ['restriction', 'version'],
                },
              },
            },
          ],
        },
      },
    },
    space: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space',
                  method: 'post',
                },
              },
            },
          ],
          modify: [
            {
              condition: {
                custom: () => isSpaceChange,
              },
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{key}',
                  method: 'put',
                },
              },
            },
            {
              condition: {
                custom:
                  () =>
                  ({ change }) => {
                    const { deletedPermissions, addedPermissions } = getPermissionsDiff(change)
                    return deletedPermissions.length > 0 || addedPermissions.length > 0
                  },
              },
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{key}/permission',
                  method: 'post',
                },
                // transformation: {
                //   adjust: async ({ context }) => {
                //     const { addedPermissions } = getPermissionsDiff(context.change)
                //     return { value: addedPermissions }
                //   },
                // },
              },
            },
            {
              condition: {
                custom:
                  () =>
                  ({ change }) => {
                    const { deletedPermissions, addedPermissions } = getPermissionsDiff(change)
                    return deletedPermissions.length > 0 || addedPermissions.length > 0
                  },
              },
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{key}/permission',
                  method: 'delete',
                },
                // transformation: {
                //   adjust: async ({ context }) => {
                //     const { deletedPermissions } = getPermissionsDiff(context.change)
                //     return { value: deletedPermissions }
                //   },
                // },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{key}',
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
