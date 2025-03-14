/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { ACCOUNT_SETTING_TYPE_NAME } from '../filters/account_settings'

/**
 * Warns the user if he activates a feature, some features may cost money or be limited
 */
export const featureActivationValidator: ChangeValidator = async changes => {
  const accountSettingsChange = changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .find(change => getChangeData(change).elemID.typeName === ACCOUNT_SETTING_TYPE_NAME)

  if (accountSettingsChange === undefined) {
    return []
  }

  const activatedFeatures = detailedCompare(accountSettingsChange.data.before, accountSettingsChange.data.after)
    .filter(isAdditionOrModificationChange)
    // zendesk.account_settings.instance._config.active_features.<feature_name>
    .filter(detailedChange => detailedChange.id.createTopLevelParentID().path[0] === 'active_features')
    .filter(detailedChange =>
      isAdditionChange(detailedChange)
        ? detailedChange.data.after === true
        : detailedChange.data.before === false && detailedChange.data.after === true,
    )
    .map(detailedChange => detailedChange.id.name)

  return activatedFeatures.length === 0
    ? []
    : [
        {
          elemID: accountSettingsChange.data.after.elemID,
          severity: 'Info',
          message: 'Activating new features may include additional cost',
          detailedMessage: `Features ${activatedFeatures.join(', ')} are marked for activation and may require additional cost in order to operate`,
        },
      ]
}
