/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, isAdditionChange, isRemovalChange } from '@salto-io/adapter-api'
import { definitions as definitionUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { DeployableRequestDefinition } from '../../shared/types'

/**
 * Definition utils for application configuration deployment
 *
 * The application configuration definition includes targeted apps, which are deployed separately from the main configuration.
 * This module provides utils for handling the targeted apps field by utilizing a custom 'targetApps' action.
 *
 */

export const targetAppsChangeCondition: definitionUtils.deploy.DeployRequestCondition = {
  custom:
    () =>
    ({ change }) => {
      const changeData = getChangeData(change)
      const targetedAppType = changeData.value.targetedManagedAppGroupType
      // The field targetedManagedAppGroupType is an enum indicating the type of targeting being used for the apps.
      // The only scenario where the user manually selects the apps is when targetedManagedAppGroupType is set to selectedPublicApps.
      // Turns out (not documented AFAICT) that changing the apps list when targetedManagedAppGroupType
      // value is different than 'selectedPublicApps' will silently set it to 'selectedPublicApps'.
      // TODO SALTO-6528: Warn the user when this happens.
      if (isRemovalChange(change) || targetedAppType !== 'selectedPublicApps') {
        return false
      }

      return isAdditionChange(change)
        ? !_.isEmpty(changeData.value.apps)
        : change.data.before.value.apps !== change.data.after.value.apps
    },
}

export const TARGET_APP_DEPLOY_DEFINITION: DeployableRequestDefinition = {
  request: {
    endpoint: {
      path: '/deviceAppManagement/targetedManagedAppConfigurations/{id}/targetApps',
      method: 'post',
    },
    transformation: {
      pick: ['apps'],
    },
  },
  condition: targetAppsChangeCondition,
}
