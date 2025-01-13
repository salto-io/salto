/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { DeployableRequestDefinition } from '../../shared/types'
import { intuneConstants } from '../../../../constants'
import { EndpointPath } from '../../../types'
import { createCustomConditionCheckChangesInFields } from '../../shared/utils'

const { APPS_FIELD_NAME } = intuneConstants
const GROUP_TYPE_FIELD_NAME = 'appGroupType'

/**
 * Creates a deploy definition for creating / updating target apps for a specific resource
 */
export const createTargetAppsDeployDefinition = ({
  resourcePath,
  targetTypeFieldName,
}: {
  resourcePath: EndpointPath
  targetTypeFieldName: string
}): DeployableRequestDefinition => ({
  request: {
    endpoint: {
      path: `${resourcePath}/{id}/targetApps`,
      method: 'post',
    },
    transformation: {
      rename: [
        {
          from: targetTypeFieldName,
          to: GROUP_TYPE_FIELD_NAME,
          onConflict: 'skip',
        },
      ],
      pick: [APPS_FIELD_NAME, GROUP_TYPE_FIELD_NAME],
    },
  },
  condition: createCustomConditionCheckChangesInFields([APPS_FIELD_NAME, targetTypeFieldName]),
})
