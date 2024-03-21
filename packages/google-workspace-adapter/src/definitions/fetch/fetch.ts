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
import { definitions } from '@salto-io/adapter-components'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'

// TODO example - adjust and remove:
// * irrelevant definitions and comments
// * unneeded function args

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  creationTime: {
    hide: true,
  },
  // TODO we dont need those fields for now
  kind: {
    hide: true,
  },
  etag: {
    hide: true,
  },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  role: {
    requests: [
      {
        endpoint: {
          path: '/customer/my_customer/roles',
        },
        transformation: {
          root: 'items',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['roleId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'roleName' }] },
      },
    },
  },
  // TODO need to make sure that the privilege is a closed list
  // privilege: {
  //   requests: [
  //     {
  //       endpoint: {
  //         path: '/customer/my_customer/roles/ALL/privileges',
  //       },
  //       transformation: {
  //         root: 'items',
  //       },
  //     },
  //   ],
  //   resource: {
  //     directFetch: true,
  //     serviceIDFields: ['serviceId'],
  //   },
  //   element: {
  //     topLevel: {
  //       isTopLevel: true,
  //       elemID: { parts: [{ fieldName: 'privilegeName' }] },
  //     },
  //   },
  // },
  domain: {
    requests: [
      {
        endpoint: {
          path: '/customer/my_customer/domains',
        },
        transformation: {
          root: 'domains',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['domainName'],
      recurseInto: {
        groups: {
          typeName: 'group',
          context: {
            args: {
              domain: {
                fromField: 'domainName',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'domainName' }] },
      },
      fieldCustomizations: {
        groups: {
          standalone: {
            typeName: 'group',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
        domainAliases: {
          standalone: {
            typeName: 'domain__domainAliases',
            addParentAnnotation: false,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  domain__domainAliases: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'domainAliasName' }] },
      },
    },
  },
  group: {
    requests: [
      {
        endpoint: {
          path: '/groups?domain={domain}',
        },
        transformation: {
          root: 'groups',
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
})

export const createFetchDefinitions = (
  _fetchConfig: UserFetchConfig,
): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
