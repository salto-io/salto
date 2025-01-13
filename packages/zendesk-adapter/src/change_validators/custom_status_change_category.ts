/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { CUSTOM_STATUS_TYPE_NAME } from '../constants'

/**
 * this change validator notifies the user that a modification in the status_category is not possible to an existing
 * status.
 */
export const customStatusCategoryChangeValidator: ChangeValidator = async changes =>
  changes
    .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => change.data.before.value.status_category !== change.data.after.value.status_category)
    .map(getChangeData)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot modify custom status category.',
        detailedMessage: 'Modifying the category of a custom status is not supported in zendesk.',
      },
    ])
