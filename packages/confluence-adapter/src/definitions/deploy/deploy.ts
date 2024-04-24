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
import { increasePagesVersion, addSpaceKey } from '../transformation_utils'
import {
  BLOG_POST_TYPE_NAME,
  GLOBAL_TEMPLATE_TYPE_NAME,
  PAGE_TYPE_NAME,
  PERMISSION_TYPE_NAME,
  SPACE_TYPE_NAME,
  TEMPLATE_TYPE_NAME,
} from '../../constants'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [BLOG_POST_TYPE_NAME]: { bulkPath: '/wiki/api/v2/blogposts', idField: 'id' },
  })

  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    [PAGE_TYPE_NAME]: {
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
                  method: 'put',
                },
                transformation: {
                  pick: ['restriction'],
                  adjust: ({ value }) => ({ value: { results: _.get(value, 'restriction') } }),
                },
              },
            },
          ],
          modify: [
            {
              condition: {
                transformForCheck: {
                  omit: ['restriction', 'version'],
                },
              },
              request: {
                endpoint: {
                  path: '/wiki/api/v2/pages/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['restriction'],
                  adjust: increasePagesVersion,
                },
              },
              copyFromResponse: {
                additional: {
                  pick: ['version.number'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/content/{id}/restriction',
                  method: 'put',
                },
                transformation: {
                  pick: ['restriction'],
                  adjust: ({ value }) => ({ value: { results: _.get(value, 'restriction') } }),
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
              },
            },
          ],
        },
      },
    },
    [SPACE_TYPE_NAME]: {
      referenceResolution: {
        when: 'early',
      },
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space',
                  method: 'post',
                },
                transformation: {
                  omit: ['permissions'],
                },
              },
            },
          ],
          modify: [
            {
              condition: {
                transformForCheck: {
                  omit: ['permissions'],
                },
              },
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{key}',
                  method: 'put',
                },
                transformation: {
                  omit: ['permissions'],
                },
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
                transformation: {
                  omit: ['permissions'],
                },
              },
            },
          ],
        },
      },
    },
    settings: {
      requestsByAction: {
        customizations: {
          modify: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/settings/lookandfeel/custom',
                  method: 'post',
                },
              },
            },
          ],
        },
      },
    },
    // If updating the template deploy definitions, check if need to update global template as well
    [TEMPLATE_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            context: {
              space_key: '{_parent.0.key}',
            },
          },
        },
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/template',
                  method: 'post',
                },
                transformation: {
                  adjust: addSpaceKey,
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/template',
                  method: 'put',
                },
                transformation: {
                  adjust: addSpaceKey,
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/template/{templateId}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
    },
    // If updating the global template deploy definitions, check if need to update template as well
    // This differs from the template definitions in the context queryArgs (no spaceKey)
    [GLOBAL_TEMPLATE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/template',
                  method: 'post',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/template',
                  method: 'put',
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/template/{templateId}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
    },
    // Permission is not a top-level type, we use it to deploy permissions changes on space instances
    [PERMISSION_TYPE_NAME]: {
      requestsByAction: {
        default: {
          request: {
            context: {
              spaceKey: '{_parent.0.value.key}',
            },
          },
        },
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{spaceKey}/permission',
                  method: 'post',
                },
              },
              copyFromResponse: {
                additional: {
                  pick: ['id'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/wiki/rest/api/space/{spaceKey}/permission/{id}',
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
