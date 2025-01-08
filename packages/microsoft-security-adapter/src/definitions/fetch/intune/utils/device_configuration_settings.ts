/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE } from '../../shared/defaults'
import { AdjustFunctionMergeAndTransform, FetchCustomizations } from '../../shared/types'
import { intuneConstants } from '../../../../constants'
import { EndpointPath } from '../../../types'
import { ASSIGNMENT_FIELD_CUSTOMIZATION } from './group_assignments'

const {
  SETTINGS_FIELD_NAME,
  SETTING_COUNT_FIELD_NAME,
  ASSIGNMENTS_ODATA_CONTEXT,
  SERVICE_BASE_URL,
  ASSIGNMENTS_FIELD_NAME,
} = intuneConstants

// In the Intune admin center, some of the device configurations (setting catalog) are located in the Device Configuration settings tab
// and some are located in the Platform Scripts tab. We align with the UI view by separating them to two different types.
export const createDeviceConfigurationSettingsFetchDefinition = ({
  typeName,
  settingsTypeName,
  filter,
  serviceUrlPath,
  adjust,
}: {
  typeName: string
  settingsTypeName: string
  filter: string
  serviceUrlPath: EndpointPath
  adjust?: AdjustFunctionMergeAndTransform
}): FetchCustomizations => ({
  [typeName]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicies',
          queryArgs: {
            $filter: filter,
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: [SETTING_COUNT_FIELD_NAME, ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [SETTINGS_FIELD_NAME]: {
          typeName: settingsTypeName,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
      mergeAndTransform: {
        adjust,
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }],
        },
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: serviceUrlPath,
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  [settingsTypeName]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicies/{id}/settings',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      fieldCustomizations: {
        id: {
          omit: true,
        },
      },
    },
  },
})
