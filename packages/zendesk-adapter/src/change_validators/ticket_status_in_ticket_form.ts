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
import _ from 'lodash'
import {
  ChangeValidator, getChangeData,
  InstanceElement, isAdditionChange,
  isAdditionOrModificationChange, isInstanceChange, isReferenceExpression,
} from '@salto-io/adapter-api'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME } from '../constants'

const ticketStatusCustomStatusName = 'Ticket_status_custom_status@suu'

const includesTicketStatus = (instance: InstanceElement): boolean => {
  const ticketFieldIds = instance.value.ticket_field_ids
  if (!_.isArray(ticketFieldIds)) {
    return false
  }
  const ticketStatus = ticketFieldIds
    .filter(isReferenceExpression)
    .map(ref => ref.elemID.name)
    .find(name => name === ticketStatusCustomStatusName)

  return ticketStatus !== undefined
}

export const additionOfTicketStatusForTicketFormValidator: ChangeValidator = async changes => {
  const ticketStatusAdditionChange = changes
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === TICKET_FIELD_TYPE_NAME)
    .find(change => getChangeData(change).value.type === 'custom_status') // there is only one

  if (ticketStatusAdditionChange === undefined) {
    return []
  }
  const ticketFormWithTicketStatusInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === TICKET_FORM_TYPE_NAME)
    .map(getChangeData)
    .filter(includesTicketStatus)

  if (_.isEmpty(ticketFormWithTicketStatusInstances)) {
    return []
  }

  return ticketFormWithTicketStatusInstances
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning',
      message: `${instance.elemID.name} will be deployed without Ticket status ticket field`,
      detailedMessage: `${instance.elemID.name} will be deployed without Ticket status ticket field since it does not exist in your zendesk account and cannot be created`,
    }))
}
