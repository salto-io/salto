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
  isAdditionOrModificationChange,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { MACRO_TYPE_NAME } from '../constants'
import { ActionsType, isAction } from './utils'

const { awu } = collections.asynciterable
const log = logger(module)

/**
 * returns a list of the names of all the inactive ticket_fields
 */
const deactivatedTicketFieldInActions = async (
  macro: InstanceElement,
  elementSource: ReadOnlyElementsSource,
): Promise<string[]> => {
  const actionWithTicketFields: ActionsType[] = macro.value.actions
    ?.filter(isAction)
    .filter(
      (action: ActionsType) => isReferenceExpression(action.field) && action.field.elemID.typeName === 'ticket_field',
    )

  return awu(actionWithTicketFields)
    .map(action => action.field)
    .filter(isReferenceExpression)
    .filter(async (ticketRef: ReferenceExpression) => {
      const ticket = await elementSource.get(ticketRef.elemID)
      if (ticket === undefined) {
        log.error(` could not find ticket_field ${ticketRef.elemID.name} in element source`)
        return false // as it is not what the change validator tries to catch.
      }
      return !ticket.value.active // if it is not active return true
    })
    .map((ticketRef: ReferenceExpression) => ticketRef.elemID.name)
    .toArray()
}

/**
 * this change validator verifies that all the action fields in a macro do not point to a deactivated ticket.
 */
export const macroActionsTicketFieldDeactivationValidator: ChangeValidator = async (changes, elementSource) => {
  const macrosInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === MACRO_TYPE_NAME)

  if (elementSource === undefined) {
    log.error('Failed to run macroActionsTicketFieldDeactivationValidator because no element source was provided')
    return []
  }
  const macroWithDeactivatedTicketFieldData = await awu(macrosInstances)
    .map(async macro => ({
      elemID: macro.elemID,
      deactivatedTicketFields: await deactivatedTicketFieldInActions(macro, elementSource),
    }))
    .filter(macroDetails => !_.isEmpty(macroDetails.deactivatedTicketFields))
    .toArray()

  return macroWithDeactivatedTicketFieldData.flatMap(({ elemID, deactivatedTicketFields }) => [
    {
      elemID,
      severity: 'Error',
      message: `One or more of the actions in macro ${elemID.name} has a deactivated ticket_field as a field`,
      detailedMessage: `One or more of the actions in macro ${elemID.name} has a deactivated ticket_field as a field. The deactivated fields are: ${deactivatedTicketFields}`,
    },
  ])
}
