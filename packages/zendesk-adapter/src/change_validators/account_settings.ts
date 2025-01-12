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
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  Value,
} from '@salto-io/adapter-api'
import { ACCOUNT_SETTING_TYPE_NAME } from '../filters/account_settings'

const getTagField = (instance: InstanceElement): Value | undefined => instance.value.routing?.autorouting_tag

export const accountSettingsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === ACCOUNT_SETTING_TYPE_NAME)
    .flatMap(change => {
      if (getTagField(change.data.before) !== getTagField(change.data.after) && getTagField(change.data.after) === '') {
        return [
          {
            elemID: getChangeData(change).elemID,
            severity: 'Error',
            message: 'Cannot change an auto-routing tag to an empty value',
            detailedMessage: 'routing.autorouting_tag cannot be empty',
          },
        ]
      }
      return []
    })
