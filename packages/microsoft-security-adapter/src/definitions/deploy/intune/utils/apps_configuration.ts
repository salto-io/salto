/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ActionName,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { definitions as definitionUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { AdditionalAction } from '../../../types'

/**
 * Definition utils for application configuration deployment
 *
 * The application configuration definition includes targeted apps, which are deployed separately from the main configuration.
 * This module provides utils for handling the targeted apps field by utilizing a custom 'targetApps' action.
 *
 */

export const modificationCondition: definitionUtils.deploy.DeployRequestCondition = {
  transformForCheck: {
    omit: ['apps'],
  },
}

export const targetAppsChangeCondition: definitionUtils.deploy.DeployRequestCondition = {
  custom:
    () =>
    ({ change }) => {
      const changeData = getChangeData(change)
      const targetedAppType = changeData.value.targetedManagedAppGroupType
      // Turns out (not documented AFAICT) that changing the apps list when targetedManagedAppGroupType
      // is different than 'selectedPublicApps' will silently set it to 'selectedPublicApps'.
      // We prioritize this field definition assuming that the apps list may contain inconsistencies
      // (hence changes) between envs when they have different applications instances.
      // TODO SALTO-6432: Warn the user when this happens.
      if (isRemovalChange(change) || targetedAppType !== 'selectedPublicApps') {
        return false
      }

      return isAdditionChange(change)
        ? !_.isEmpty(changeData.value.apps)
        : change.data.before.value.apps !== change.data.after.value.apps
    },
}

export const toActionNames: ({
  change,
}: definitionUtils.deploy.ChangeAndContext) => (ActionName | AdditionalAction)[] = ({ change }) => {
  if (isAdditionOrModificationChange(change)) {
    // Conditions inside 'targetApps' will determine if it should be called
    return [change.action, 'targetApps']
  }
  return [change.action]
}

export const actionDependencies: definitionUtils.deploy.ActionDependency<AdditionalAction>[] = [
  {
    first: 'add',
    second: 'targetApps',
  },
  {
    first: 'modify',
    second: 'targetApps',
  },
]
