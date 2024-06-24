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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME } from '../constants'

const includesTicketStatus = (instance: InstanceElement): boolean => {
  const ticketFieldIds = instance.value.ticket_field_ids
  if (!_.isArray(ticketFieldIds)) {
    return false
  }
  const ticketStatus = ticketFieldIds
    .filter(isReferenceExpression)
    .map(ref => ref.value.value?.type)
    .find(type => type === TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME)

  return ticketStatus !== undefined
}

/**
 * In this change validator we warn the user that the addition of ticket_field Ticket status is not supported
 * and therefore we warn that ticket_forms with reference to this ticket_field will be deployed without it.
 */
export const additionOfTicketStatusForTicketFormValidator: ChangeValidator = async changes => {
  const ticketStatusAdditionChange = changes
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === TICKET_FIELD_TYPE_NAME)
    .find(change => getChangeData(change).value.type === 'custom_status') // there is only one

  if (ticketStatusAdditionChange === undefined) {
    return []
  }
  const ticketStatusInstance = getChangeData(ticketStatusAdditionChange)
  const ticketFormWithTicketStatusInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === TICKET_FORM_TYPE_NAME)
    .map(getChangeData)
    .filter(includesTicketStatus)

  const ticketFormWarnings: ChangeError[] = ticketFormWithTicketStatusInstances.map(instance => ({
    elemID: instance.elemID,
    severity: 'Warning',
    message: "Ticket form will be deployed without 'Ticket status' ticket field",
    detailedMessage: `Ticket form ${instance.elemID.name} will be deployed without the parts referencing the 'Ticket status' ticket field, since that field does not exist in your zendesk account and cannot be created`,
  }))

  const ticketFieldWarning: ChangeError = {
    elemID: ticketStatusInstance.elemID,
    severity: 'Warning',
    message: 'Ticket field of type custom_status will not be deployed',
    detailedMessage: `The addition of the ticket field '${ticketStatusInstance.elemID.name}' of type 'custom_status' is not supported by zendesk`,
  }

  return ticketFormWarnings.concat(ticketFieldWarning)
}
