/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isRemovalChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { TICKET_FORM_ORDER_TYPE_NAME, TICKET_FORM_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

/**
 * Handles dependencies between ticket_forms and ticket_form_order
 * * New ticket_forms that are not included in the ticket_form_order must be deployed after the order
 * * Removed ticket_forms must be deployed before the order
 *
 * This is because ticket_form_order deploy must contain all the current existing ticket_forms
 */
export const ticketFormDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const ticketFormChanges = instanceChanges.filter(
    ({ change }) => getChangeData(change).elemID.typeName === TICKET_FORM_TYPE_NAME,
  )
  const ticketFormOrderChange = instanceChanges.find(
    change => getChangeData(change.change).elemID.typeName === TICKET_FORM_ORDER_TYPE_NAME,
  )

  // If the form_order did not change, there is nothing to do
  if (ticketFormOrderChange === undefined) {
    return []
  }

  const ticketFormOrderValue = getChangeData(ticketFormOrderChange.change).value
  const orderTicketForms = new Set(
    (ticketFormOrderValue.active ?? [])
      .concat(ticketFormOrderValue.inactive ?? [])
      // Filter out referenceExpressions that are unresolved (which means they don't have a value)
      .filter(isReferenceExpression)
      .filter((ref: ReferenceExpression) => isInstanceElement(ref.value))
      .map((ref: ReferenceExpression) => ref.value.elemID.getFullName())
      .flat(),
  )

  const addedFormsDependencies = ticketFormChanges
    .filter(change => isAdditionChange(change.change))
    .map(change => {
      const ticketFormInstance = getChangeData(change.change)
      // If we can't find the ticket_form in the ticket_form_order, add a dependency from the ticket form to the order
      if (!orderTicketForms.has(ticketFormInstance.elemID.getFullName())) {
        return dependencyChange('add', change.key, ticketFormOrderChange.key)
      }
      return undefined
    })
    .filter(isDefined)

  // Forms need to be removed before the ticket_form_order, otherwise we will get an incomplete list error from zendesk
  const removedFormsDependencies = ticketFormChanges
    .filter(change => isRemovalChange(change.change))
    .map(change => dependencyChange('add', ticketFormOrderChange.key, change.key))

  return addedFormsDependencies.concat(removedFormsDependencies)
}
