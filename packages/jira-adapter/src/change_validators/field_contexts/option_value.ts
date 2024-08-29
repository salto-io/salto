/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { JiraConfig } from '../../config/config'
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../../filters/fields/constants'

/**
 * Verify that the option has a value
 */
export const optionValueValidator: (config: JiraConfig) => ChangeValidator = config => async changes => {
  if (!config.fetch.splitFieldContextOptions) {
    return []
  }
  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)
    .filter(option => option.value.value === undefined)
    .map(option => ({
      elemID: option.elemID,
      severity: 'Error',
      message: 'Option value must be defined',
      detailedMessage: "Cannot deploy a context option without the 'value' field",
    }))
}
