/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { getChangeData, isAdditionChange, isRemovalChange } from '@salto-io/adapter-api'
import { definitions as definitionUtils } from '@salto-io/adapter-components'
import { DeployableRequestDefinition } from '../../shared/types'
import { intuneConstants } from '../../../../constants'
import { EndpointPath } from '../../../types'

const { APPS_FIELD_NAME } = intuneConstants

/**
 * Utilities for deploying the target apps field.
 *
 * This module handles the targeted apps field, which is deployed separately from the main configuration,
 * by defining the deploy request and condition.
 */

const createTargetAppsChangeCondition = (
  targetTypeFieldName: string,
): definitionUtils.deploy.DeployRequestCondition => ({
  custom:
    () =>
    ({ change }) => {
      const changeData = getChangeData(change)
      const targetedAppType = changeData.value[targetTypeFieldName]
      // If targetedManagedAppGroupType is set to anything other than `selectedPublicApps`,
      // modifying the apps list will silently change it to `selectedPublicApps`.
      // TODO SALTO-6528: Warn the user when this occurs.
      if (isRemovalChange(change) || (targetedAppType && targetedAppType !== 'selectedPublicApps')) {
        return false
      }

      return isAdditionChange(change)
        ? !_.isEmpty(changeData.value.apps)
        : change.data.before.value.apps !== change.data.after.value.apps
    },
})

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
      pick: [APPS_FIELD_NAME],
    },
  },
  condition: createTargetAppsChangeCondition(targetTypeFieldName),
})
