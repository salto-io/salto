/*
*                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { ChangeValidator, ReferenceExpression, getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { VIEW_TYPE_NAME, TICKET_FORM_TYPE_NAME } from '../constants'

const log = logger(module)

export const viewWithNoInactiveTicketsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run dynamicContentDeletionValidator because element source is undefined')
    return []
  }

  const changedViews = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === VIEW_TYPE_NAME)

  if (changedViews.length === 0) {
    return []
  }

  const existingTicketFormInstances = await getInstancesFromElementSource(elementSource, [TICKET_FORM_TYPE_NAME])
  const deactivatedTicketFormIDs = existingTicketFormInstances
    .filter(ticketForm => ticketForm.value.active === false).map(form => form.elemID)


  return changedViews
    .flatMap(change => {
      const conditions = (change.data.after.value?.conditions?.all || [])
        .concat((change.data.after.value?.conditions?.any || []))

      // cross-reference deactivated ticket forms with conditions in the view
      const deactivatedTicketsReferenced: string[] = conditions
        .filter((condition: { field: string }) => condition.field === 'ticket_form_id')
        .filter(
          (condition: { value: ReferenceExpression }) => 
            deactivatedTicketFormIDs
              .find(inactiveElemID => inactiveElemID.isEqual(condition.value.elemID)) !== undefined
        )
        .map((condition: { value: ReferenceExpression }) => condition.value.elemID.name)

      if (deactivatedTicketsReferenced.length === 0) {
        return []
      }

      return {
        elemID: change.data.after.elemID,
        severity: 'Error',
        message: 'Deactivated Ticket Forms linked to a view',
        detailedMessage: `Deactivated ticket forms cannot be used in the conditions of a view. The Deactivated forms used are: ${_.uniq(deactivatedTicketsReferenced).join(', ')}`,
      }
    })
}
