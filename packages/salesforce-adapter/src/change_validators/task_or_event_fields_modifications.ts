/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  isFieldChange,
  Field,
  getChangeData,
  ChangeError,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { inspectValue } from '@salto-io/adapter-utils'
import { EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../constants'
import { apiNameSync, isCustomObjectSync } from '../filters/utils'

const isFieldOfTaskOrEvent = ({ parent }: Field): boolean =>
  isCustomObjectSync(parent) && [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(apiNameSync(parent) ?? '')

const isFieldOfActivity = ({ parent }: Field): boolean =>
  isCustomObjectSync(parent) && ['Activity'].includes(apiNameSync(parent) ?? '')

const createFieldOfTaskOrEventChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Modifying a field of Task or Event is not allowed',
  detailedMessage: `Modifying the field ${field.name} of the ${apiNameSync(field.parent)} object directly is forbidden. Instead, modify the corresponding field in the Activity Object.\n${inspectValue(field)}`,
})

const changeValidator: ChangeValidator = async changes => {
  const activityFieldChanges = changes.filter(isFieldChange).filter(change => isFieldOfActivity(getChangeData(change)))

  return changes
    .filter(isFieldChange)
    .filter(change => isFieldOfTaskOrEvent(getChangeData(change)))
    .map((fieldChange): ChangeError | undefined => {
      const field: Field = getChangeData(fieldChange)
      const refApiName = apiNameSync(field.annotations.activityField.value, true)
      const matchingChanges = activityFieldChanges.filter(change => apiNameSync(getChangeData(change), true) === refApiName)
      if (matchingChanges.length !== 1) {
        return createFieldOfTaskOrEventChangeError(field)
      }
      const activityFieldChange = matchingChanges.pop()
      if (fieldChange.action === 'modify' || activityFieldChange?.action !== fieldChange.action) {
        return createFieldOfTaskOrEventChangeError(field)
      }
      return undefined
    })
    .filter(change => change !== undefined) as ChangeError[]
}

export default changeValidator
