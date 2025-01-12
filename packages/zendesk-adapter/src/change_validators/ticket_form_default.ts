/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { TICKET_FORM_TYPE_NAME } from '../constants'

export const onlyOneTicketFormDefaultValidator: ChangeValidator = async (changes, elementSource) => {
  const defaultTicketFormsFromChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === TICKET_FORM_TYPE_NAME)
    .filter(instance => instance.value.default === true)

  const defaultTicketFormsNames = new Set<string>(defaultTicketFormsFromChanges.map(form => form.elemID.getFullName()))

  if (defaultTicketFormsFromChanges.length === 0) {
    return []
  }

  const defaultTicketFormsFromElementSource =
    elementSource !== undefined
      ? (await getInstancesFromElementSource(elementSource, [TICKET_FORM_TYPE_NAME]))
          .filter(form => !defaultTicketFormsNames.has(form.elemID.getFullName()))
          .filter(form => form.value.default === true)
      : []

  if (defaultTicketFormsFromChanges.length > 1) {
    return defaultTicketFormsFromChanges.map(form => ({
      elemID: form.elemID,
      severity: 'Error',
      message: 'More than one ticket form is set as default',
      detailedMessage: `Only one ticket form can be set as default, default ticket forms: ${defaultTicketFormsFromChanges.map(ticketForm => ticketForm.elemID.name).join(', ')}`,
    }))
  }
  if (defaultTicketFormsFromElementSource.length > 0) {
    return [
      {
        elemID: defaultTicketFormsFromChanges[0].elemID,
        severity: 'Warning',
        message: 'Setting a new default ticket form will unset the previous default ticket form',
        detailedMessage: `Setting this ticket form as default will unset the other default ticket forms: ${defaultTicketFormsFromElementSource.map(ticketForm => ticketForm.elemID.name).join(', ')}`,
      },
    ]
  }
  return []
}
