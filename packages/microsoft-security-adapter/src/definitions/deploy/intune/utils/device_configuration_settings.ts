/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { assignments } from '.'
import { intuneConstants } from '../../../../constants'
import { InstanceDeployApiDefinitions } from '../../shared/types'

const { ASSIGNMENTS_FIELD_NAME } = intuneConstants

// In the Intune admin center, some of the device configurations (setting catalog) are located in the Device Configuration settings tab
// and some are located in the Platform Scripts tab. We align with the UI view by separating them to two different types.
export const DEVICE_CONFIGURATION_SETTINGS_DEPLOY_DEFINITION: InstanceDeployApiDefinitions = {
  requestsByAction: {
    customizations: {
      add: [
        {
          request: {
            endpoint: {
              path: '/deviceManagement/configurationPolicies',
              method: 'post',
            },
            transformation: {
              omit: [ASSIGNMENTS_FIELD_NAME],
            },
          },
        },
        assignments.createAssignmentsRequest({
          resourcePath: '/deviceManagement/configurationPolicies',
        }),
      ],
      modify: [
        {
          request: {
            endpoint: {
              path: '/deviceManagement/configurationPolicies/{id}',
              method: 'put',
            },
            transformation: {
              omit: [ASSIGNMENTS_FIELD_NAME],
            },
          },
          condition: {
            transformForCheck: {
              omit: [ASSIGNMENTS_FIELD_NAME],
            },
          },
        },
        assignments.createAssignmentsRequest({
          resourcePath: '/deviceManagement/configurationPolicies',
        }),
      ],
      remove: [
        {
          request: {
            endpoint: {
              path: '/deviceManagement/configurationPolicies/{id}',
              method: 'delete',
            },
          },
        },
      ],
    },
  },
}
