/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, isInstanceElement, isModificationChange, getChangeData } from '@salto-io/adapter-api'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

export const systemFieldsValidator: ChangeValidator = async changes =>
  changes
    .map(change => (isModificationChange(change) ? change.data.before : getChangeData(change)))
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(instance => instance.value.schema !== undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Can not deploy changes to a Jira system field',
      detailedMessage:
        'This is a built-in Jira system field, and can not be edited or deleted. Changes to this field will not be deployed.',
    }))
