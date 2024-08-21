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
  const activityFieldChanges = changes
    .filter(isFieldChange)
    .filter(change => isFieldOfActivity(getChangeData(change)))

  return changes
    .filter(isFieldChange)
    .filter(change => isFieldOfTaskOrEvent(getChangeData(change)))
    .map((fieldChange): ChangeError | undefined => {
      const field: Field = getChangeData(fieldChange)
      const activityFieldChange = activityFieldChanges.filter(change => getChangeData(change).name === field.name).pop()
      if (fieldChange.action === 'modify') {
        return createFieldOfTaskOrEventChangeError(field)
      }
      if (activityFieldChange === undefined || activityFieldChange.action !== fieldChange.action) {
        return {
          elemID: field.elemID,
          severity: 'Error',
          message: 'Modifying a field of Task or Event is not allowed',
          detailedMessage: `Adding / removing the field ${field.name} of the ${apiNameSync(field.parent)} object only possible when the corresponding field in the Activity Object is added / removed as well.`,

        }
      }
      if (activityFieldChange.action === 'add') {
        const expectedFieldName = getChangeData(activityFieldChange).annotations.apiName.replace('Activity', apiNameSync(field.parent))
        if (field.annotations.apiName !== expectedFieldName) {
          return {
            elemID: field.elemID,
            severity: 'Error',
            message: 'Modifying a field of Task or Event is not allowed',
            detailedMessage: `Adding the field ${field.name} of the ${apiNameSync(field.parent)} object doesn't match the expected field name ${expectedFieldName} in the Activity Object.`,
          }
        }
        const activityFieldRef = field.annotations.activityField
        if (!isReferenceExpression(activityFieldRef) || activityFieldRef.elemID.getFullName() !== getChangeData(activityFieldChange).elemID.getFullName()) {
          return {
            elemID: field.elemID,
            severity: 'Error',
            message: 'Modifying a field of Task or Event is not allowed',
            detailedMessage: `Adding the field ${field.name} of the ${apiNameSync(field.parent)} object should reference ${getChangeData(activityFieldChange).annotations.apiName}`
          }
        }
      }
      return undefined
    })
    .filter(change => change !== undefined) as ChangeError[]
}

export default changeValidator
