/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {
  Change, dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange, isReferenceExpression, ReferenceExpression,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { TICKET_FORM_TYPE_NAME } from '../constants'
import { ChangeWithKey } from './types'

const { isDefined } = lowerDashValues

/**
 * Check if there is a new ticket_form that is not included in a ticket_form_order change
 * If there is, the ticket_form_order need to be deployed first, otherwise an error will be returned by Zendesk
 *  saying that the ticket_form_order is incomplete
 *
 *  If the ticket_form is included in the list, we don't need to do anything
 */
export const newTicketFormDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is ChangeWithKey<Change<InstanceElement>> =>
        isInstanceChange(change.change)
    )

  const newTicketFormChanges = instanceChanges.filter(change => isAdditionChange(change.change))
    .filter(change => getChangeData(change.change).elemID.typeName === TICKET_FORM_TYPE_NAME)
  const ticketFormOrderChange = instanceChanges.find(change => getChangeData(change.change).elemID.typeName === 'ticket_form_order')

  // If there is no ticket_form_order change or no new ticket forms, we don't need to do anything
  if (ticketFormOrderChange === undefined || newTicketFormChanges.length === 0) {
    return []
  }

  const ticketFormOrderValue = getChangeData(ticketFormOrderChange.change).value
  const orderTicketForms = ticketFormOrderValue.active.concat(ticketFormOrderValue.inactive)
    .filter(isReferenceExpression)


  return newTicketFormChanges.map(change => {
    const ticketFormInstance = getChangeData(change.change)
    // If we can't find the ticket_form in the ticket_form_order, add a dependency from the ticket form to the order
    if (orderTicketForms.find((form: ReferenceExpression) => form.value.isEqual(ticketFormInstance)) === undefined) {
      return dependencyChange(
        'add',
        change.key,
        ticketFormOrderChange.key
      )
    }
    return undefined
  }).filter(isDefined)
}
