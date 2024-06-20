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
import {
  API_ROLE_TYPE_NAME,
  BUILDING_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CLASS_TYPE_NAME,
  DEPARTMENT_TYPE_NAME,
  PACKAGE_TYPE_NAME,
  POLICY_TYPE_NAME,
  SCRIPT_TYPE_NAME,
  SITE_TYPE_NAME,
} from '../../constants'
import * as transforms from './transforms'

const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created_at: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  created_by_id: {
    hide: true,
  },
  updated_by_id: {
    hide: true,
  },
}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  _links: {
    omit: true,
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
  [BUILDING_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/buildings',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [DEPARTMENT_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/departments',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [CATEGORY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/categories',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [SCRIPT_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/scripts',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        categoryName: {
          omit: true,
        },
        id: {
          hide: true,
        },
      },
    },
  },
  [API_ROLE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/api-roles',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'displayName' }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [SITE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/sites',
          // this is not a classic API, but no pagination function like classic api
          client: 'classicApi',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  class_minimal: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/classes',
          client: 'classicApi',
        },
        transformation: {
          root: 'classes',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [CLASS_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/classes/id/{id}',
          client: 'classicApi',
        },
        transformation: {
          root: 'class',
          adjust: transforms.adjustClass,
        },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          id: {
            parentTypeName: 'class_minimal',
            transformation: {
              root: 'id',
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  policy_minimal: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/policies',
          client: 'classicApi',
        },
        transformation: {
          root: 'policies',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/policies/id/{id}',
          client: 'classicApi',
        },
        transformation: {
          root: 'policy',
          adjust: transforms.adjustPolicy,
        },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          id: {
            parentTypeName: 'policy_minimal',
            transformation: {
              root: 'id',
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'general.name' }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [PACKAGE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/packages',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'packageName' }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
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
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
