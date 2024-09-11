/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ASSIGNMENTS_FIELD_NAME } from '../../../../constants/intune'
import { EndpointPath } from '../../../types'
import { DeployableRequestDefinition } from '../../shared/types'
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
