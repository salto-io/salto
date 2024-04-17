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
import { increasePagesVersion } from '../transformation_utils'
import {
  BLOG_POST_TYPE_NAME,
  GLOBAL_TEMPLATE_TYPE_NAME,
  PAGE_TYPE_NAME,
  PERMISSION_TYPE_NAME,
  SPACE_TYPE_NAME,
  TEMPLATE_TYPE_NAME,
} from '../../constants'
import { isSpaceChange } from '../transformation_utils/space'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [BLOG_POST_TYPE_NAME]: { bulkPath: '/wiki/api/v2/blogposts', idField: 'id' },
    [GLOBAL_TEMPLATE_TYPE_NAME]: { bulkPath: '/wiki/rest/api/template', idField: 'templateId' },
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
          ],
          modify: [
            {
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
      // referenceResolution: {
      //   when: 'early',
      // },
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
                custom: () => isSpaceChange,
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
    [TEMPLATE_TYPE_NAME]: {
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
                context: {
                  queryArgs: {
                    spaceKey: '{space.key}',
                  },
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
    [PERMISSION_TYPE_NAME]: {
      requestsByAction: {
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
        default: {
          request: {
            context: {
              spaceKey: '{_parent.0.value.key}',
            },
          },
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
