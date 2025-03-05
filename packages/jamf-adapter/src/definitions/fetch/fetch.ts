/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
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
  DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME,
} from '../../constants'
import * as transforms from './transforms'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {}

const createCustomizations = (
  baseUrl: string,
): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
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
        serviceUrl: {
          baseUrl,
          path: '/view/settings/network-organization/buildings/{id}',
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [`${DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME}_single`]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/diskencryptionconfigurations/id/{id}',
          client: 'classicApi',
        },
        transformation: {
          root: 'disk_encryption_configuration',
        },
      },
    ],
  },

  [DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/JSSResource/diskencryptionconfigurations',
          // TODON need to enter into /JSSResource/diskencryptionconfigurations/id/{id} + see how to point to them
          client: 'classicApi',
        },
        transformation: {
          root: 'disk_encryption_configurations',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        full: {
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
          typeName: `${DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME}_single`,
        },
      },
      mergeAndTransform: {
        root: 'full',
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS },
        serviceUrl: {
          baseUrl,
          path: '/diskEncryptions.html?id={id}',
        },
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
        serviceUrl: {
          baseUrl,
          path: '/view/settings/network-organization/departments/{id}',
        },
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
        serviceUrl: {
          baseUrl,
          path: '/categories.html?id={id}&o=r',
        },
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
        serviceUrl: {
          baseUrl,
          path: '/view/settings/computer-management/scripts/{id}?tab=general',
        },
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
        serviceUrl: {
          baseUrl,
          path: 'view/settings/system-settings/api-roles-and-clients/api-roles/{id}',
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
        serviceUrl: {
          baseUrl,
          path: '/sites.html?id={id}&o=r',
        },
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
        serviceUrl: {
          baseUrl,
          path: '/classes.html?id={id}&o=r&nav=c',
        },
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
        serviceUrl: {
          baseUrl,
          path: '/policies.html?id={id}&o=r',
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
        serviceUrl: {
          baseUrl,
          path: '/view/settings/computer-management/packages/{id}?tab=general',
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
          omit: ['general.uuid'],
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
        serviceUrl: {
          baseUrl,
          path: '/OSXConfigurationProfiles.html?id={id}&o=r&side-tabs=General',
        },
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
          omit: ['general.uuid'],
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
        serviceUrl: {
          baseUrl,
          path: '/iOSConfigurationProfiles.html?id={id}&o=r&side-tabs=General',
        },
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
          omit: ['scope.computer_groups', 'vpp.vpp_admin_account_id'],
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
        serviceUrl: {
          baseUrl,
          path: '/macApps.html?id={id}&o=r',
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
  baseUrl: string,
): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
        onError: fetchUtils.errors.createGetInsufficientPermissionsErrorFunction([401, 403]),
      },
      element: {
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(baseUrl),
  },
})
