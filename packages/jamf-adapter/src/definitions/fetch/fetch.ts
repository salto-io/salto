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
  RESULTS,
  OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
  MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
  MAC_APPLICATION_TYPE_NAME,
} from '../../constants'
import * as transforms from './transforms'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  [BUILDING_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/api/v1/buildings',
        },
        transformation: {
          root: RESULTS,
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
          root: RESULTS,
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
          root: RESULTS,
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
          root: RESULTS,
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
          root: RESULTS,
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
  [`${CLASS_TYPE_NAME}_minimal`]: {
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
            parentTypeName: `${CLASS_TYPE_NAME}_minimal`,
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
  [`${POLICY_TYPE_NAME}_minimal`]: {
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
            parentTypeName: `${POLICY_TYPE_NAME}_minimal`,
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
          root: RESULTS,
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
  [`${OS_X_CONFIGURATION_PROFILE_TYPE_NAME}_minimal`]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/osxconfigurationprofiles',
          client: 'classicApi',
        },
        transformation: {
          root: 'os_x_configuration_profiles',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  [OS_X_CONFIGURATION_PROFILE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/osxconfigurationprofiles/id/{id}',
          client: 'classicApi',
        },
        transformation: {
          root: 'os_x_configuration_profile',
          omit: ['general.uuid', 'general.payloads'],
          adjust: transforms.adjustConfigurationProfile,
        },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          id: {
            parentTypeName: `${OS_X_CONFIGURATION_PROFILE_TYPE_NAME}_minimal`,
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
        elemID: { parts: [{ fieldName: 'general.name' }] },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [`${MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME}_minimal`]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/mobiledeviceconfigurationprofiles',
          client: 'classicApi',
        },
        transformation: {
          root: 'configuration_profiles',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  [MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/mobiledeviceconfigurationprofiles/id/{id}',
          client: 'classicApi',
        },
        transformation: {
          root: 'configuration_profile',
          omit: ['general.uuid', 'general.payloads'],
          adjust: transforms.adjustConfigurationProfile,
        },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          id: {
            parentTypeName: `${MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME}_minimal`,
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
        elemID: { parts: [{ fieldName: 'general.name' }] },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [`${MAC_APPLICATION_TYPE_NAME}_minimal`]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/macapplications',
          client: 'classicApi',
        },
        transformation: {
          root: 'mac_applications',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  [MAC_APPLICATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/macapplications/id/{id}',
          client: 'classicApi',
        },
        transformation: {
          root: MAC_APPLICATION_TYPE_NAME,
          adjust: transforms.adjustMacApplication,
        },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          id: {
            parentTypeName: `${MAC_APPLICATION_TYPE_NAME}_minimal`,
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
        elemID: { parts: [{ fieldName: 'general.name' }] },
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
