/*
 * Copyright 2025 Salto Labs Ltd.
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
  isModificationChange,
  Change,
} from '@salto-io/adapter-api'
import { ACTIVITY_CUSTOM_OBJECT } from '../constants'
import { apiNameSync, isFieldOfTaskOrEvent } from '../filters/utils'

const isFieldOfActivity = ({ parent }: Field): boolean => apiNameSync(parent) === ACTIVITY_CUSTOM_OBJECT

const createFieldOfTaskOrEventChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Modifying a field of Task or Event is not allowed',
  detailedMessage: `Modifying the field ${field.name} of the ${apiNameSync(field.parent)} object directly is forbidden. Instead, modify the corresponding field in the Activity Object.`,
})

export const findMatchingActivityChange = (
  taskOrEventChange: Change,
  changes: readonly Change[],
): Change | undefined => {
  const activityChange = changes.find(
    change =>
      isFieldChange(change) &&
      isFieldOfActivity(getChangeData(change)) &&
      apiNameSync(getChangeData(change), true) === apiNameSync(getChangeData(taskOrEventChange), true) &&
      change.action === taskOrEventChange.action,
  )
  if (activityChange === undefined || isModificationChange(taskOrEventChange)) {
    return undefined
  }
  return activityChange
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isFieldChange)
    .filter(change => isFieldOfTaskOrEvent(getChangeData(change)))
    .map((fieldChange): ChangeError | undefined => {
      if (!findMatchingActivityChange(fieldChange, changes)) {
        return createFieldOfTaskOrEventChangeError(getChangeData(fieldChange))
      }
      return undefined
    })
    .filter(change => change !== undefined) as ChangeError[]

export default changeValidator
