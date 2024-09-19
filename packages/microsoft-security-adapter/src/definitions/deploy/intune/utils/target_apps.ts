/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validatePlainObject } from '@salto-io/adapter-utils'
import { DeployableRequestDefinition } from '../../shared/types'
import { intuneConstants } from '../../../../constants'
import { EndpointPath } from '../../../types'
import { createCustomConditionCheckChangesInFields } from '../../shared/utils'

const { APPS_FIELD_NAME } = intuneConstants

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
      adjust: async ({ value, typeName }) => {
        validatePlainObject(value, typeName)
        return {
          value: {
            [APPS_FIELD_NAME]: value[APPS_FIELD_NAME],
            appGroupType: value[targetTypeFieldName],
          },
        }
      },
    },
  },
  condition: createCustomConditionCheckChangesInFields([APPS_FIELD_NAME, targetTypeFieldName]),
})
