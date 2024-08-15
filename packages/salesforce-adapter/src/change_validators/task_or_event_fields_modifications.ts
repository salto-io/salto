/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, isFieldChange, Field, getChangeData, ChangeError } from '@salto-io/adapter-api'
import { EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../constants'
import { apiNameSync, isCustomObjectSync } from '../filters/utils'

const isFieldOfTaskOrEvent = ({ parent }: Field): boolean =>
  isCustomObjectSync(parent) && [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(apiNameSync(parent) ?? '')

const createFieldOfTaskOrEventChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Modifying a field of Task or Event is not allowed',
  detailedMessage: `Modifying the field ${field.name} of the ${apiNameSync(field.parent)} object directly is forbidden. Instead, modify the corresponding field in the Activity Object`,
})

const changeValidator: ChangeValidator = async changes =>
  changes.filter(isFieldChange).map(getChangeData).filter(isFieldOfTaskOrEvent).map(createFieldOfTaskOrEventChangeError)

export default changeValidator
