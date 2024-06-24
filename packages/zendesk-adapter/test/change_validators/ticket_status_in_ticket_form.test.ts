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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { additionOfTicketStatusForTicketFormValidator } from '../../src/change_validators'

const getMsg = (): string => "Ticket form will be deployed without 'Ticket status' ticket field"

const getDetailedMsg = (inst: InstanceElement): string =>
  `Ticket form ${inst.elemID.name} will be deployed without the parts referencing the 'Ticket status' ticket field, since that field does not exist in your zendesk account and cannot be created`

describe('additionOfTicketStatusForTicketFormValidator', () => {
  const ticketFormType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) })
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })

  const ticketStatusInstance = new InstanceElement('status', ticketFieldType, {
    type: 'custom_status',
  })

  const ticketFieldInstance = new InstanceElement('Ticket_status_text', ticketFieldType, {
    type: 'text',
  })
  const ticketFormWithTicketStatusInstance = new InstanceElement('ticketFormWithTicketStatus', ticketFormType, {
    ticket_field_ids: [new ReferenceExpression(ticketStatusInstance.elemID, ticketStatusInstance)],
  })

  const ticketFormWithoutTicketStatusInstance = new InstanceElement('ticketFormWithoutTicketStatus', ticketFormType, {
    ticket_field_ids: [new ReferenceExpression(ticketFieldInstance.elemID, ticketFieldInstance)],
  })

  const ticketStatusChangeError = {
    elemID: ticketStatusInstance.elemID,
    severity: 'Warning',
    message: 'Ticket field of type custom_status will not be deployed',
    detailedMessage: `The addition of the ticket field '${ticketStatusInstance.elemID.name}' of type 'custom_status' is not supported by zendesk`,
  }

  it('should return a warning when there is an addition of ticket status and this ticket field appears in ticket form addition', async () => {
    const errors = await additionOfTicketStatusForTicketFormValidator([
      toChange({ after: ticketFormWithTicketStatusInstance }),
      toChange({ after: ticketStatusInstance }),
    ])
    expect(errors).toEqual([
      {
        elemID: ticketFormWithTicketStatusInstance.elemID,
        severity: 'Warning',
        message: getMsg(),
        detailedMessage: getDetailedMsg(ticketFormWithTicketStatusInstance),
      },
      ticketStatusChangeError,
    ])
  })
  it('should not return a warning when there is an addition of a ticket form with ticket status without addition of ticket status', async () => {
    const errors = await additionOfTicketStatusForTicketFormValidator([
      toChange({ after: ticketFormWithTicketStatusInstance }),
    ])
    expect(errors).toEqual([])
  })
  it('should not return a warning for ticket form when the ticket form does not include a ticket status', async () => {
    const errors = await additionOfTicketStatusForTicketFormValidator([
      toChange({ after: ticketFormWithoutTicketStatusInstance }),
      toChange({ after: ticketStatusInstance }),
      toChange({ after: ticketFieldInstance }),
    ])
    expect(errors).toEqual([ticketStatusChangeError])
  })
})
