/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ASSIGNMENTS_FIELD_NAME } from '../../../../constants/intune'
import { EndpointPath } from '../../../types'
import { DeployableRequestDefinition, InstanceDeployApiDefinitions } from '../../shared/types'
import { createCustomConditionCheckChangesInFields } from '../../shared/utils'

/**
 * Creates a request to assign a group to a resource. This request is used for both addition and modification changes.
 */
export const createAssignmentsRequest = ({
  resourcePath,
  rootField = ASSIGNMENTS_FIELD_NAME,
}: {
  resourcePath: EndpointPath
  rootField?: string
}): DeployableRequestDefinition => ({
  request: {
    endpoint: {
      path: `${resourcePath}/{id}/assign`,
      method: 'post',
    },
    transformation: {
      rename: [
        {
          from: ASSIGNMENTS_FIELD_NAME,
          to: rootField,
          onConflict: 'skip',
        },
      ],
      pick: [rootField],
    },
  },
  condition: createCustomConditionCheckChangesInFields([ASSIGNMENTS_FIELD_NAME]),
})

/**
 * Creates a basic deploy definition for a type with assignments.
 * This definition includes requests for adding, modifying and removing the resource, as well as assigning groups to the resource.
 */
export const createBasicDeployDefinitionForTypeWithAssignments = ({
  resourcePath,
  assignmentRootField,
}: {
  resourcePath: EndpointPath
  assignmentRootField?: string
}): InstanceDeployApiDefinitions['requestsByAction'] => ({
  customizations: {
    add: [
      {
        request: {
          endpoint: {
            path: resourcePath,
            method: 'post',
          },
          transformation: {
            omit: [ASSIGNMENTS_FIELD_NAME],
          },
        },
      },
      createAssignmentsRequest({ resourcePath, rootField: assignmentRootField }),
    ],
    modify: [
      {
        request: {
          endpoint: {
            path: `${resourcePath}/{id}`,
            method: 'patch',
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
      createAssignmentsRequest({ resourcePath, rootField: assignmentRootField }),
    ],
    remove: [
      {
        request: {
          endpoint: {
            path: `${resourcePath}/{id}`,
            method: 'delete',
          },
        },
      },
    ],
  },
})
